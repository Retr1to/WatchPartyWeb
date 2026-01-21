namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Representa un video programado para reproducirse en una fecha específica
    /// </summary>
    public class ScheduledVideo
    {
        /// <summary>
        /// ID único del video programado
        /// </summary>
        public string Id { get; set; } = Guid.NewGuid().ToString();

        /// <summary>
        /// Nombre del archivo de video
        /// </summary>
        public string VideoFileName { get; set; } = string.Empty;

        /// <summary>
        /// Título del video (opcional)
        /// </summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Fecha y hora programada para reproducción
        /// </summary>
        public DateTime ScheduledTime { get; set; }

        /// <summary>
        /// ID del usuario que programó el video
        /// </summary>
        public string ScheduledBy { get; set; } = string.Empty;

        /// <summary>
        /// Nombre del usuario que programó el video
        /// </summary>
        public string ScheduledByUsername { get; set; } = string.Empty;

        /// <summary>
        /// Fecha en que se creó la programación
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Indica si el video ya se reprodujo
        /// </summary>
        public bool IsPlayed { get; set; } = false;

        /// <summary>
        /// Indica si está cancelado
        /// </summary>
        public bool IsCancelled { get; set; } = false;
    }
}