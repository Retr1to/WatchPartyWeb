namespace WatchPartyBackend.Contracts
{
    public class RoomSummary
    {
        public string RoomCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Visibility { get; set; } = string.Empty;
        public UserSummary Owner { get; set; } = new UserSummary();
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivityAt { get; set; }
    }
}
