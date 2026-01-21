using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    /// <summary>
    /// Gestiona todas las salas y la lógica de sincronización
    /// </summary>
    public class RoomManager
    {
        private readonly ConcurrentDictionary<string, Room> _rooms = new();

        public Action<string>? OnRoomRemoved { get; set; }

        private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        public Room GetOrCreateRoom(string roomId, string userId)
        {
            return _rooms.GetOrAdd(roomId, _ => new Room
            {
                RoomId = roomId,
                HostId = userId
            });
        }

        public async Task<string> AddConnection(string roomId, string userId, string sessionKey, WebSocket webSocket, string username = "") 
        {
            var room = GetOrCreateRoom(roomId, userId);

            if (string.IsNullOrWhiteSpace(sessionKey))
            {
                sessionKey = Guid.NewGuid().ToString("N");
            }

            var effectiveUserId = userId;

            if (room.Connections.ContainsKey(userId))
            {
                if (room.SessionKeys.TryGetValue(userId, out var existingSessionKey) &&
                    string.Equals(existingSessionKey, sessionKey, StringComparison.Ordinal))
                {
                    if (room.Connections.TryGetValue(userId, out var oldSocket))
                    {
                        await CloseWebSocketSafely(oldSocket);
                    }
                }
                else
                {
                    var guidToken = Guid.NewGuid().ToString("N")[..8];
                    effectiveUserId = $"user_{guidToken}";
                    while (room.Connections.ContainsKey(effectiveUserId))
                    {
                        guidToken = Guid.NewGuid().ToString("N")[..8];
                        effectiveUserId = $"user_{guidToken}";
                    }
                }
            }

            room.Connections.AddOrUpdate(effectiveUserId, webSocket, (_, _) => webSocket);
            room.SessionKeys.AddOrUpdate(effectiveUserId, sessionKey, (_, _) => sessionKey);

            if (!string.IsNullOrEmpty(username))
            {
                room.Usernames.AddOrUpdate(effectiveUserId, username, (_, _) => username);
            }

            return effectiveUserId;
        }

        public bool RoomExists(string roomId)
        {
            return _rooms.ContainsKey(roomId);
        }

        public bool HasSessionConflict(string roomId, string userId, string sessionKey)
        {
            if (string.IsNullOrWhiteSpace(userId)) return false;
            if (string.IsNullOrWhiteSpace(sessionKey)) return false;
            if (!_rooms.TryGetValue(roomId, out var room)) return false;

            if (!room.Connections.ContainsKey(userId)) return false;

            if (!room.SessionKeys.TryGetValue(userId, out var existingSessionKey)) return true;
            return !string.Equals(existingSessionKey, sessionKey, StringComparison.Ordinal);
        }

        public bool RemoveConnection(string roomId, string userId, WebSocket? webSocket = null)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                if (webSocket != null)
                {
                    if (!room.Connections.TryGetValue(userId, out var currentSocket))
                    {
                        return false;
                    }

                    if (!ReferenceEquals(currentSocket, webSocket))
                    {
                        return false;
                    }
                }

                if (!room.Connections.TryRemove(userId, out _))
                {
                    return false;
                }
                room.Usernames.TryRemove(userId, out _);
                room.SessionKeys.TryRemove(userId, out _);

                if (room.Connections.IsEmpty)
                {
                    if (_rooms.TryRemove(roomId, out _))
                    {
                        try
                        {
                            OnRoomRemoved?.Invoke(roomId);
                        }
                        catch
                        {
                            // ignore cleanup errors
                        }
                    }
                }

                return true;
            }

            return false;
        }

        public bool TryReassignHost(string roomId, out string newHostId)
        {
            newHostId = string.Empty;
            if (!_rooms.TryGetValue(roomId, out var room)) return false;

            var candidate = room.Connections.Keys.FirstOrDefault();
            if (string.IsNullOrEmpty(candidate) || candidate == room.HostId) return false;

            room.HostId = candidate;
            newHostId = candidate;
            return true;
        }

        public bool IsHost(string roomId, string userId)
        {
            return _rooms.TryGetValue(roomId, out var room) && room.HostId == userId;
        }

        public bool ValidateSession(string roomId, string userId, string sessionKey)
        {
            if (string.IsNullOrWhiteSpace(sessionKey)) return false;
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            return room.SessionKeys.TryGetValue(userId, out var existing) &&
                   string.Equals(existing, sessionKey, StringComparison.Ordinal);
        }

        public void UpdateVideoState(string roomId, VideoState newState)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.VideoState = newState;
                room.VideoState.LastUpdated = DateTime.UtcNow;
            }
        }

        public VideoState? GetVideoState(string roomId)
        {
            return _rooms.TryGetValue(roomId, out var room) ? room.VideoState : null;
        }

        public Dictionary<string, string> GetRoomUsers(string roomId)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return new Dictionary<string, string>();
            }

            return new Dictionary<string, string>(room.Usernames);
        }

        public async Task BroadcastToRoom(string roomId, WebSocketMessage message, string? excludeUserId = null)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return;

            var messageJson = JsonSerializer.Serialize(message, _jsonOptions);
            var messageBytes = Encoding.UTF8.GetBytes(messageJson);
            var payload = new ArraySegment<byte>(messageBytes);

            var tasks = new List<Task>();

            foreach (var (userId, socket) in room.Connections)
            {
                if (userId == excludeUserId) continue;
                tasks.Add(TrySendAsync(roomId, userId, socket, payload));
            }

            await Task.WhenAll(tasks);
        }

        public async Task SendToUser(string roomId, string userId, WebSocketMessage message)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return;
            if (!room.Connections.TryGetValue(userId, out var socket)) return;

            var messageJson = JsonSerializer.Serialize(message, _jsonOptions);
            var messageBytes = Encoding.UTF8.GetBytes(messageJson);
            await TrySendAsync(roomId, userId, socket, new ArraySegment<byte>(messageBytes));
        }

        private async Task TrySendAsync(string roomId, string userId, WebSocket socket, ArraySegment<byte> payload)
        {
            if (socket.State != WebSocketState.Open)
            {
                RemoveConnection(roomId, userId, socket);
                return;
            }

            try
            {
                await socket.SendAsync(payload, WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch
            {
                RemoveConnection(roomId, userId, socket);
            }
        }

        private async Task CloseWebSocketSafely(WebSocket? socket, CancellationToken cancellationToken = default)
        {
            if (socket == null) return;

            if (socket.State == WebSocketState.Open ||
                socket.State == WebSocketState.CloseReceived ||
                socket.State == WebSocketState.CloseSent)
            {
                try
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Connection replaced", cancellationToken);
                }
                catch (OperationCanceledException) { }
                catch (ObjectDisposedException) { }
                catch (WebSocketException) { }
            }

            try
            {
                socket.Dispose();
            }
            catch (ObjectDisposedException) { }
        }

        // ============================================================
        // VIDEO QUEUE MANAGEMENT (usando VideoQueue del compañero)
        // ============================================================

        public VideoQueue? GetQueue(string roomId)
        {
            return _rooms.TryGetValue(roomId, out var room) ? room.Queue : null;
        }

        public bool AddToQueue(string roomId, QueueItem item)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            room.Queue.AddItem(item);
            return true;
        }

        public bool RemoveFromQueue(string roomId, string itemId)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            return room.Queue.RemoveItem(itemId);
        }

        public bool ReorderQueue(string roomId, List<string> itemIds)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            return room.Queue.Reorder(itemIds);
        }

        public bool UpdateQueueSettings(string roomId, bool autoAdvance)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return false;
            room.Queue.AutoAdvance = autoAdvance;
            return true;
        }

        public QueueItem? AdvanceQueue(string roomId)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return null;
            return room.Queue.AdvanceToNext();
        }

        public QueueItem? AdvanceQueueToItem(string roomId, string itemId)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return null;
            return room.Queue.AdvanceToItem(itemId);
        }

        public List<(string RoomId, QueueItem Item)> GetScheduledItemsDue()
        {
            var result = new List<(string, QueueItem)>();
            foreach (var (roomId, room) in _rooms)
            {
                var dueItems = room.Queue.GetScheduledItemsDue();
                foreach (var item in dueItems)
                {
                    result.Add((roomId, item));
                }
            }
            return result;
        }

        public IEnumerable<string> GetAllRoomIds()
        {
            return _rooms.Keys.ToList();
        }

        // ============================================================
        // ✅ SCHEDULED VIDEOS (nueva funcionalidad)
        // ============================================================

        public List<ScheduledVideo>? GetScheduledVideos(string roomId)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return null;
            }

            return room.ScheduledVideos
                .Where(v => !v.IsPlayed && !v.IsCancelled)
                .OrderBy(v => v.ScheduledTime)
                .ToList();
        }

        public bool AddScheduledVideo(string roomId, ScheduledVideo video)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return false;
            }

            room.ScheduledVideos.Add(video);
            return true;
        }

        public bool CancelScheduledVideo(string roomId, string scheduledId)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return false;
            }

            var video = room.ScheduledVideos.FirstOrDefault(v => v.Id == scheduledId);
            if (video == null)
            {
                return false;
            }

            video.IsCancelled = true;
            return true;
        }

        public ScheduledVideo? GetNextScheduledVideo(string roomId)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return null;
            }

            return room.ScheduledVideos
                .Where(v => !v.IsPlayed && !v.IsCancelled && v.ScheduledTime <= DateTime.UtcNow)
                .OrderBy(v => v.ScheduledTime)
                .FirstOrDefault();
        }

        public bool MarkScheduledAsPlayed(string roomId, string scheduledId)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return false;
            }

            var video = room.ScheduledVideos.FirstOrDefault(v => v.Id == scheduledId);
            if (video == null)
            {
                return false;
            }

            video.IsPlayed = true;
            return true;
        }
    }
}