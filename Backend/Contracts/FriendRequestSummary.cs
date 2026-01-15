namespace WatchPartyBackend.Contracts
{
    public class FriendRequestSummary
    {
        public int Id { get; set; }
        public UserSummary From { get; set; } = new UserSummary();
        public DateTime CreatedAt { get; set; }
    }
}
