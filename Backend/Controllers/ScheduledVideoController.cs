using Microsoft.AspNetCore.Mvc;
using WatchPartyBackend.Models;
using WatchPartyBackend.Services;

namespace WatchPartyBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ScheduledVideoController : ControllerBase
    {
        private readonly RoomManager _roomManager;
        private readonly ILogger<ScheduledVideoController> _logger;

        public ScheduledVideoController(RoomManager roomManager, ILogger<ScheduledVideoController> logger)
        {
            _roomManager = roomManager;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todos los videos programados de una sala
        /// </summary>
        [HttpGet("{roomId}")]
        public IActionResult GetScheduledVideos(string roomId)
        {
            var scheduled = _roomManager.GetScheduledVideos(roomId);
            if (scheduled == null)
            {
                return NotFound(new { message = "Sala no encontrada" });
            }

            return Ok(scheduled);
        }

        /// <summary>
        /// Programa un video para una fecha específica
        /// </summary>
        [HttpPost("{roomId}")]
        public async Task<IActionResult> ScheduleVideo(string roomId, [FromBody] ScheduleVideoRequest request)
        {
            var userId = Request.Headers["X-User-Id"].ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Usuario no autenticado" });
            }

            // Solo el host puede programar videos
            if (!_roomManager.IsHost(roomId, userId))
            {
                return Forbid("Solo el anfitrión puede programar videos");
            }

            // Validar que la fecha sea futura
            if (request.ScheduledTime <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "La fecha debe ser futura" });
            }

            var scheduledVideo = new ScheduledVideo
            {
                VideoFileName = request.VideoFileName,
                Title = request.Title ?? request.VideoFileName,
                ScheduledTime = request.ScheduledTime,
                ScheduledBy = userId,
                ScheduledByUsername = request.Username ?? "Usuario"
            };

            var success = _roomManager.AddScheduledVideo(roomId, scheduledVideo);
            if (!success)
            {
                return NotFound(new { message = "Sala no encontrada" });
            }

            // Notificar a todos
            await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "scheduled_video_added",
                Data = new { scheduledVideo }
            });

            return Ok(scheduledVideo);
        }

        /// <summary>
        /// Cancela un video programado
        /// </summary>
        [HttpDelete("{roomId}/{scheduledId}")]
        public async Task<IActionResult> CancelScheduledVideo(string roomId, string scheduledId)
        {
            var userId = Request.Headers["X-User-Id"].ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Usuario no autenticado" });
            }

            // Solo el host puede cancelar
            if (!_roomManager.IsHost(roomId, userId))
            {
                return Forbid("Solo el anfitrión puede cancelar videos programados");
            }

            var success = _roomManager.CancelScheduledVideo(roomId, scheduledId);
            if (!success)
            {
                return NotFound(new { message = "Video programado no encontrado" });
            }

            // Notificar a todos
            await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "scheduled_video_cancelled",
                Data = new { scheduledId }
            });

            return Ok(new { message = "Video programado cancelado" });
        }

        /// <summary>
        /// Obtiene el próximo video programado que debe reproducirse
        /// </summary>
        [HttpGet("{roomId}/next")]
        public IActionResult GetNextScheduled(string roomId)
        {
            var nextVideo = _roomManager.GetNextScheduledVideo(roomId);
            if (nextVideo == null)
            {
                return NotFound(new { message = "No hay videos programados pendientes" });
            }

            return Ok(nextVideo);
        }
    }

    public class ScheduleVideoRequest
    {
        public string VideoFileName { get; set; } = string.Empty;
        public string? Title { get; set; }
        public DateTime ScheduledTime { get; set; }
        public string? Username { get; set; }
    }
}