using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    /// <summary>
    /// Background service que revisa videos programados y los reproduce cuando llega su hora
    /// </summary>
    public class QueueSchedulerService : BackgroundService
    {
        private readonly RoomManager _roomManager;
        private readonly ILogger<QueueSchedulerService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(5);

        public QueueSchedulerService(RoomManager roomManager, ILogger<QueueSchedulerService> logger)
        {
            _roomManager = roomManager;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("QueueSchedulerService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckScheduledItems();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking scheduled queue items");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }

            _logger.LogInformation("QueueSchedulerService stopped");
        }

        private async Task CheckScheduledItems()
        {
            var dueItems = _roomManager.GetScheduledItemsDue();

            foreach (var (roomId, item) in dueItems)
            {
                _logger.LogInformation(
                    "Scheduled item {ItemId} is due for room {RoomId}. Advancing queue.",
                    item.ItemId,
                    roomId
                );

                // Avanzar la cola al item programado
                var advancedItem = _roomManager.AdvanceQueueToItem(roomId, item.ItemId);
                if (advancedItem != null)
                {
                    // Actualizar el estado del video en la sala
                    var newVideoState = new VideoState
                    {
                        VideoFileName = advancedItem.VideoFileName ?? string.Empty,
                        VideoUrl = advancedItem.VideoUrl,
                        Provider = advancedItem.Provider,
                        VideoId = advancedItem.VideoId,
                        CurrentTime = 0,
                        IsPlaying = false
                    };
                    _roomManager.UpdateVideoState(roomId, newVideoState);

                    // Obtener información de la cola
                    var queue = _roomManager.GetQueue(roomId);

                    // Broadcast queue_advance a todos los usuarios de la sala
                    await _roomManager.BroadcastToRoom(roomId, new WebSocketMessage
                    {
                        Type = "queue_advance",
                        QueueItem = advancedItem,
                        QueueItems = queue?.GetItems(),
                        CurrentQueueIndex = queue?.CurrentIndex,
                        VideoUrl = advancedItem.VideoUrl,
                        VideoFileName = advancedItem.VideoFileName,
                        Provider = advancedItem.Provider,
                        VideoId = advancedItem.VideoId,
                        State = newVideoState,
                        Message = $"Queue advanced to: {advancedItem.Title ?? advancedItem.VideoUrl}"
                    });

                    _logger.LogInformation(
                        "Queue advanced to item {ItemId} in room {RoomId}",
                        advancedItem.ItemId,
                        roomId
                    );
                }
            }
        }
    }
}
