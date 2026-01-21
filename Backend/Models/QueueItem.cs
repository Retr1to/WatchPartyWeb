namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Representa un item en la cola de videos de una sala
    /// </summary>
    public class QueueItem
    {
        /// <summary>
        /// Identificador único del item
        /// </summary>
        public string ItemId { get; set; } = Guid.NewGuid().ToString("N");

        /// <summary>
        /// URL del video (para videos externos o YouTube)
        /// </summary>
        public string VideoUrl { get; set; } = string.Empty;

        /// <summary>
        /// Nombre del archivo de video (para videos subidos)
        /// </summary>
        public string? VideoFileName { get; set; }

        /// <summary>
        /// Proveedor del video: "file", "url", "youtube"
        /// </summary>
        public string Provider { get; set; } = "url";

        /// <summary>
        /// ID del video (para YouTube)
        /// </summary>
        public string? VideoId { get; set; }

        /// <summary>
        /// Título opcional del video
        /// </summary>
        public string? Title { get; set; }

        /// <summary>
        /// Posición en la cola (0-indexed)
        /// </summary>
        public int Position { get; set; }

        /// <summary>
        /// Fecha/hora programada en UTC (para planificación absoluta)
        /// </summary>
        public DateTime? ScheduledAtUtc { get; set; }

        /// <summary>
        /// Tipo de planificación: "none", "absolute", "relative_time", "relative_videos"
        /// </summary>
        public string ScheduleType { get; set; } = "none";

        /// <summary>
        /// Minutos relativos para planificación (para relative_time)
        /// </summary>
        public int? RelativeMinutes { get; set; }

        /// <summary>
        /// Cantidad de videos a esperar antes de reproducir (para relative_videos)
        /// </summary>
        public int? RelativeVideoCount { get; set; }

        /// <summary>
        /// Fecha de creación del item
        /// </summary>
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// ID del usuario que agregó el item
        /// </summary>
        public string AddedByUserId { get; set; } = string.Empty;
    }
}
