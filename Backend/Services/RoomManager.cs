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
        public void AddConnection(string roomId, string userId, WebSocket webSocket, string username = "")
        {
            var room = GetOrCreateRoom(roomId, userId);
            room.Connections.TryAdd(userId, webSocket);

            // ✅ Guardar username
            if (!string.IsNullOrEmpty(username))
            {
                room.Usernames.TryAdd(userId, username);
            }
        }

        /// <summary>
        /// Remueve una conexión de una sala
        /// </summary>
        public void RemoveConnection(string roomId, string userId)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.Connections.TryRemove(userId, out _);
                room.Usernames.TryRemove(userId, out _);

                // Si la sala queda vacía, eliminarla
                if (room.Connections.IsEmpty)
                {
                    _rooms.TryRemove(roomId, out _);
                }
            }
        }

        /// <summary>
        /// Verifica si un usuario es el host de una sala
        /// </summary>
        public bool IsHost(string roomId, string userId)
        {
            return _rooms.TryGetValue(roomId, out var room) && room.HostId == userId;
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

            var tasks = new List<Task>();

            foreach (var (userId, socket) in room.Connections)
            {
                // No enviar al usuario excluido (por ejemplo, el que originó el mensaje)
                if (userId == excludeUserId) continue;

                if (socket.State == WebSocketState.Open)
                {
                    tasks.Add(socket.SendAsync(
                        new ArraySegment<byte>(messageBytes),
                        WebSocketMessageType.Text,
                        true,
                        CancellationToken.None
                    ));
                }
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

            if (socket.State == WebSocketState.Open)
            {
                var messageJson = JsonSerializer.Serialize(message, _jsonOptions);
                var messageBytes = Encoding.UTF8.GetBytes(messageJson);

                await socket.SendAsync(
                    new ArraySegment<byte>(messageBytes),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None
                );
            }
        }
    }
}