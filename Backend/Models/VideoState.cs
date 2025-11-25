namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Estado actual del video en una sala
    /// </summary>
    public class VideoState
    {
        /// <summary>
        /// Nombre del archivo de video actual
        /// </summary>
        public string VideoFileName { get; set; } = string.Empty;

        /// <summary>
        /// Timestamp actual del video (en segundos)
        /// </summary>
        public double CurrentTime { get; set; } = 0;

        /// <summary>
        /// Indica si el video está reproduciendo o pausado
        /// </summary>
        public bool IsPlaying { get; set; } = false;

        /// <summary>
        /// Timestamp de última actualización (para sincronización)
        /// </summary>
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }
}