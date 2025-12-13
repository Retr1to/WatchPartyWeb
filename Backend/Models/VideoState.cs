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
        /// URL remota del video (cuando no es un archivo subido)
        /// </summary>
        public string? VideoUrl { get; set; }

        /// <summary>
        /// Proveedor o tipo de fuente (file, url, youtube)
        /// </summary>
        public string Provider { get; set; } = "file";

        /// <summary>
        /// Identificador del video (por ejemplo, YouTube videoId)
        /// </summary>
        public string? VideoId { get; set; }

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
