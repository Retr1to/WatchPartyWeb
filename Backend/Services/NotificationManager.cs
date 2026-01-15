using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    /// <summary>
    /// Gestiona conexiones WebSocket globales para notificaciones en tiempo real
    /// </summary>
    public class NotificationManager
    {
        // userId -> WebSocket
        private readonly ConcurrentDictionary<int, WebSocket> _connections = new();

        private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        /// <summary>
        /// Agrega una conexión de notificación para un usuario
        /// </summary>
        public async Task<bool> AddConnection(int userId, WebSocket webSocket)
        {
            // Si ya existe una conexión, cerrarla antes de reemplazarla
            if (_connections.TryGetValue(userId, out var oldSocket))
            {
                await CloseWebSocketSafely(oldSocket);
                _connections.TryUpdate(userId, webSocket, oldSocket);
                return true;
            }

            return _connections.TryAdd(userId, webSocket);
        }

        /// <summary>
        /// Remueve la conexión de un usuario
        /// </summary>
        public bool RemoveConnection(int userId)
        {
            return _connections.TryRemove(userId, out _);
        }

        /// <summary>
        /// Envía una notificación a un usuario específico
        /// </summary>
        public async Task SendToUser(int userId, WebSocketMessage message)
        {
            if (!_connections.TryGetValue(userId, out var socket))
            {
                return;
            }

            if (socket.State != WebSocketState.Open)
            {
                RemoveConnection(userId);
                return;
            }

            try
            {
                var messageJson = JsonSerializer.Serialize(message, _jsonOptions);
                var messageBytes = Encoding.UTF8.GetBytes(messageJson);
                await socket.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch
            {
                RemoveConnection(userId);
            }
        }

        /// <summary>
        /// Envía una notificación a múltiples usuarios
        /// </summary>
        public async Task SendToUsers(IEnumerable<int> userIds, WebSocketMessage message)
        {
            var tasks = userIds.Select(userId => SendToUser(userId, message));
            await Task.WhenAll(tasks);
        }

        /// <summary>
        /// Cierra de forma segura una conexión WebSocket
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
                catch
                {
                    // Ignore exceptions during close
                }
            }

            try
            {
                socket.Dispose();
            }
            catch
            {
                // Ignore disposal exceptions
            }
        }
    }
}
