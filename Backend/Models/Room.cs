using System.Collections.Concurrent;
using System.Net.WebSockets;

namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Representa una sala de Watch Party
    /// </summary>
    public class Room
    {
        /// <summary>
        /// ID único de la sala
        /// </summary>
        public string RoomId { get; set; } = string.Empty;

        /// <summary>
        /// ID del usuario que es el host (controla el video)
        /// </summary>
        public string HostId { get; set; } = string.Empty;

        /// <summary>
        /// Estado actual del video en esta sala
        /// </summary>
        public VideoState VideoState { get; set; } = new VideoState();

        /// <summary>
        /// Conexiones WebSocket activas: Key = UserId, Value = WebSocket
        /// </summary>
        public ConcurrentDictionary<string, WebSocket> Connections { get; set; }
            = new ConcurrentDictionary<string, WebSocket>();

        /// <summary>
        /// Nombres de usuarios: Key = UserId, Value = Username
        /// </summary>
        public ConcurrentDictionary<string, string> Usernames { get; set; }
            = new ConcurrentDictionary<string, string>();

        /// <summary>
        /// Llaves de sesión por usuario (para evitar suplantación por UserId).
        /// </summary>
        public ConcurrentDictionary<string, string> SessionKeys { get; set; }
            = new ConcurrentDictionary<string, string>();

        /// <summary>
        /// Fecha de creación de la sala
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
