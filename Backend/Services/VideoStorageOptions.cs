namespace WatchPartyBackend.Services;

public sealed class VideoStorageOptions
{
    public required string RootPath { get; init; }

    // Set to <= 0 to disable periodic cleanup.
    public TimeSpan CleanupInterval { get; init; } = TimeSpan.Zero;

    // Only directories older than this (and not tied to an active room) are deleted.
    public TimeSpan MaxAge { get; init; } = TimeSpan.FromHours(24);
}

