using System.Collections.Concurrent;
using System.Net.WebSockets;

namespace WatchPartyBackend.Models
{
    public class Room
    {
        public string RoomId { get; set; } = string.Empty;
        public string HostId { get; set; } = string.Empty;
        public VideoState VideoState { get; set; } = new VideoState();
        public ConcurrentDictionary<string, WebSocket> Connections { get; set; } = new ConcurrentDictionary<string, WebSocket>();
        public ConcurrentDictionary<string, string> Usernames { get; set; } = new ConcurrentDictionary<string, string>();
        public ConcurrentDictionary<string, string> SessionKeys { get; set; } = new ConcurrentDictionary<string, string>();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public VideoQueue Queue { get; set; } = new VideoQueue();
        public List<ScheduledVideo> ScheduledVideos { get; set; } = new List<ScheduledVideo>();
    }
}