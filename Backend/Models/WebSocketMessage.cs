namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Representa los mensajes que se envían/reciben por WebSocket
    /// </summary>
    public class WebSocketMessage
    {
        /// <summary>
        /// Tipo de mensaje: "play", "pause", "seek", "join", "state", "video_uploaded"
        /// </summary>
        public string Type { get; set; } = string.Empty;

        /// <summary>
        /// Timestamp del video (en segundos)
        /// </summary>
        public double? Timestamp { get; set; }

        /// <summary>
        /// Tiempo del servidor en el que se emite el mensaje (Unix epoch en milisegundos)
        /// </summary>
        public long? SentAtUnixMs { get; set; }

        /// <summary>
        /// ID del usuario que envía el mensaje
        /// </summary>
        public string? UserId { get; set; }

        public string? Username { get; set; }

        /// <summary>
        /// Indica si el usuario es el host
        /// </summary>
        public bool IsHost { get; set; }

        /// <summary>
        /// Nombre del video actual (opcional)
        /// </summary>
        public string? VideoFileName { get; set; }

        /// <summary>
        /// URL completa cuando el video proviene de un enlace
        /// </summary>
        public string? VideoUrl { get; set; }

        /// <summary>
        /// Proveedor o tipo de fuente (file, url, youtube)
        /// </summary>
        public string? Provider { get; set; }

        /// <summary>
        /// Identificador del video (p. ej. YouTube videoId)
        /// </summary>
        public string? VideoId { get; set; }

        /// <summary>
        /// Indica si el video está reproduciendo
        /// </summary>
        public bool? IsPlaying { get; set; }

        /// <summary>
        /// Mensaje adicional (para notificaciones)
        /// </summary>
        public string? Message { get; set; }

        /// <summary>
        /// Estado completo del video (para nuevos usuarios)
        /// </summary>
        public VideoState? State { get; set; }
    }
}
