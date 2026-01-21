using Microsoft.AspNetCore.Mvc;
using WatchPartyBackend.Models;
using WatchPartyBackend.Services;

namespace WatchPartyBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VideoQueueController : ControllerBase
    {
        private readonly RoomManager _roomManager;
        private readonly ILogger<VideoQueueController> _logger;

        public VideoQueueController(RoomManager roomManager, ILogger<VideoQueueController> logger)
        {
            _roomManager = roomManager;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene la cola de videos de una sala
        /// </summary>
        [HttpGet("{roomId}")]
        public IActionResult GetQueue(string roomId)
        {
            var queue = _roomManager.GetVideoQueue(roomId);
            if (queue == null)
            {
                return NotFound(new { message = "Sala no encontrada" });
            }

            return Ok(queue);
        }

        /// <summary>
        /// Agrega un video a la cola
        /// </summary>
        [HttpPost("{roomId}")]
        public async Task<IActionResult> AddToQueue(string roomId, [FromBody] AddToQueueRequest request)
        {
            var userId = Request.Headers["X-User-Id"].ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Usuario no autenticado" });
            }

            var item = new VideoQueueItem
            {
                VideoFileName = request.VideoFileName,
                Title = request.Title ?? request.VideoFileName,
                AddedBy = userId,
                AddedByUsername = request.Username ?? "Usuario"
            };

            var success = _roomManager.AddToQueue(roomId, item);
            if (!success)
            {
                return NotFound(new { message = "Sala no encontrada" });
            }

            // Notificar a todos en la sala
            await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "queue_updated",
                Data = new { queue = _roomManager.GetVideoQueue(roomId) }
            });

            return Ok(item);
        }

        /// <summary>
        /// Elimina un video de la cola
        /// </summary>
        [HttpDelete("{roomId}/{itemId}")]
        public async Task<IActionResult> RemoveFromQueue(string roomId, string itemId)
        {
            var userId = Request.Headers["X-User-Id"].ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Usuario no autenticado" });
            }

            // Solo el host puede eliminar
            if (!_roomManager.IsHost(roomId, userId))
            {
                return Forbid("Solo el anfitrión puede eliminar videos de la cola");
            }

            var success = _roomManager.RemoveFromQueue(roomId, itemId);
            if (!success)
            {
                return NotFound(new { message = "Video no encontrado en la cola" });
            }

            // Notificar a todos
            await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "queue_updated",
                Data = new { queue = _roomManager.GetVideoQueue(roomId) }
            });

            return Ok(new { message = "Video eliminado de la cola" });
        }

        /// <summary>
        /// Reproduce el siguiente video de la cola
        /// </summary>
        [HttpPost("{roomId}/next")]
        public async Task<IActionResult> PlayNext(string roomId)
        {
            var userId = Request.Headers["X-User-Id"].ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Usuario no autenticado" });
            }

            // Solo el host puede cambiar de video
            if (!_roomManager.IsHost(roomId, userId))
            {
                return Forbid("Solo el anfitrión puede cambiar de video");
            }

            var nextVideo = _roomManager.PlayNextInQueue(roomId);
            if (nextVideo == null)
            {
                return NotFound(new { message = "No hay videos en la cola" });
            }

            // Notificar a todos sobre el nuevo video
            await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "video_changed",
                Data = new 
                { 
                    videoFileName = nextVideo.VideoFileName,
                    title = nextVideo.Title,
                    queue = _roomManager.GetVideoQueue(roomId)
                }
            });

            return Ok(nextVideo);
        }

        /// <summary>
        /// Reordena la cola de videos
        /// </summary>
        [HttpPut("{roomId}/reorder")]
        public async Task<IActionResult> ReorderQueue(string roomId, [FromBody] List<string> itemIds)
        {
            var userId = Request.Headers["X-User-Id"].ToString();
            
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "Usuario no autenticado" });
            }

            // Solo el host puede reordenar
            if (!_roomManager.IsHost(roomId, userId))
            {
                return Forbid("Solo el anfitrión puede reordenar la cola");
            }

            var success = _roomManager.ReorderQueue(roomId, itemIds);
            if (!success)
            {
                return BadRequest(new { message = "Error al reordenar la cola" });
            }

            // Notificar a todos
            await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "queue_updated",
                Data = new { queue = _roomManager.GetVideoQueue(roomId) }
            });

            return Ok(new { message = "Cola reordenada" });
        }
    }

    public class AddToQueueRequest
    {
        public string VideoFileName { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Username { get; set; }
    }
}