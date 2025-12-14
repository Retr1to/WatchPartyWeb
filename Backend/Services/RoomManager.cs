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

        /// <summary>
        /// Obtiene o crea una sala
        /// </summary>
        public Room GetOrCreateRoom(string roomId, string userId)
        {
            return _rooms.GetOrAdd(roomId, _ => new Room
            {
                RoomId = roomId,
                HostId = userId // El primero en entrar es el host
            });
        }

        /// <summary>
        /// Agrega una conexión a una sala
        /// </summary>
        public async Task<string> AddConnection(string roomId, string userId, string sessionKey, WebSocket webSocket, string username = "")
        {
            var room = GetOrCreateRoom(roomId, userId);
            
            // If a client reconnects with the same (userId, sessionKey), replace the old socket to avoid
            // leaving multiple active WebSocket connections for the same logical session.
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

            // ✅ Guardar username
            if (!string.IsNullOrEmpty(username))
            {
                room.Usernames.AddOrUpdate(effectiveUserId, username, (_, _) => username);
            }

            return effectiveUserId;
        }

        /// <summary>
        /// Remueve una conexión de una sala
        /// </summary>
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

            // If the userId is currently connected but the stored session key doesn't match,
            // treat it as a conflict (potential hijack / duplicate identity).
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

                // Si la sala queda vacía, eliminarla
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

        /// <summary>
        /// Verifica si un usuario es el host de una sala
        /// </summary>
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

        /// <summary>
        /// Actualiza el estado del video en una sala
        /// </summary>
        public void UpdateVideoState(string roomId, VideoState newState)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.VideoState = newState;
                room.VideoState.LastUpdated = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Obtiene el estado actual del video en una sala
        /// </summary>
        public VideoState? GetVideoState(string roomId)
        {
            return _rooms.TryGetValue(roomId, out var room) ? room.VideoState : null;
        }

        /// <summary>
        /// Obtiene la lista de usuarios conectados con sus nombres
        /// </summary>
        public Dictionary<string, string> GetRoomUsers(string roomId)
        {
            if (!_rooms.TryGetValue(roomId, out var room))
            {
                return new Dictionary<string, string>();
            }

            return new Dictionary<string, string>(room.Usernames);
        }

        /// <summary>
        /// Envía un mensaje a todos los usuarios de una sala
        /// </summary>
        public async Task BroadcastToRoom(string roomId, WebSocketMessage message, string? excludeUserId = null)
        {
            if (!_rooms.TryGetValue(roomId, out var room)) return;

            var messageJson = JsonSerializer.Serialize(message, _jsonOptions);
            var messageBytes = Encoding.UTF8.GetBytes(messageJson);
            var payload = new ArraySegment<byte>(messageBytes);

            var tasks = new List<Task>();

            foreach (var (userId, socket) in room.Connections)
            {
                // No enviar al usuario excluido (por ejemplo, el que originó el mensaje)
                if (userId == excludeUserId) continue;

                tasks.Add(TrySendAsync(roomId, userId, socket, payload));
            }

            await Task.WhenAll(tasks);
        }

        /// <summary>
        /// Envía un mensaje a un usuario específico
        /// </summary>
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

        /// <summary>
        /// Safely closes a WebSocket connection to prevent resource leaks
        /// </summary>
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
                catch (OperationCanceledException)
                {
                    // Ignore cancellation exceptions
                }
                catch (ObjectDisposedException)
                {
                    // Socket already disposed, nothing to do
                }
                catch (WebSocketException)
                {
                    // WebSocket is in a bad state, will dispose below
                }
            }

            try
            {
                socket.Dispose();
            }
            catch (ObjectDisposedException)
            {
                // Socket already disposed, nothing to do
            }
        }
    }
}
