using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace WatchPartyBackend.Services;

public sealed class VideoStorageCleanupService : BackgroundService
{
    private readonly VideoStorageOptions _options;
    private readonly RoomManager _roomManager;
    private readonly ILogger<VideoStorageCleanupService> _logger;

    public VideoStorageCleanupService(
        VideoStorageOptions options,
        RoomManager roomManager,
        ILogger<VideoStorageCleanupService> logger)
    {
        _options = options;
        _roomManager = roomManager;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_options.CleanupInterval <= TimeSpan.Zero)
        {
            _logger.LogInformation(
                "Video storage cleanup disabled (WATCHPARTY_VIDEO_CLEANUP_INTERVAL_MINUTES <= 0). Root={Root}",
                _options.RootPath);
            return;
        }

        _logger.LogInformation(
            "Video storage cleanup enabled. Root={Root} Interval={Interval} MaxAge={MaxAge}",
            _options.RootPath,
            _options.CleanupInterval,
            _options.MaxAge);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_options.CleanupInterval, stoppingToken);
                CleanupOnce();
            }
            catch (OperationCanceledException)
            {
                // shutting down
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Video storage cleanup iteration failed");
            }
        }
    }

    private void CleanupOnce()
    {
        if (string.IsNullOrWhiteSpace(_options.RootPath)) return;
        if (!Directory.Exists(_options.RootPath)) return;

        var now = DateTime.UtcNow;

        foreach (var dir in Directory.EnumerateDirectories(_options.RootPath))
        {
            var roomId = Path.GetFileName(dir);
            if (string.IsNullOrWhiteSpace(roomId)) continue;

            if (_roomManager.RoomExists(roomId))
            {
                continue;
            }

            DateTime lastWriteUtc;
            try
            {
                lastWriteUtc = Directory.GetLastWriteTimeUtc(dir);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed reading last write time for {Dir}", dir);
                continue;
            }

            var age = now - lastWriteUtc;
            if (age < _options.MaxAge)
            {
                continue;
            }

            try
            {
                Directory.Delete(dir, recursive: true);
                _logger.LogInformation("Deleted stale video directory {Dir} (age={Age})", dir, age);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed deleting stale video directory {Dir}", dir);
            }
        }
    }
}

