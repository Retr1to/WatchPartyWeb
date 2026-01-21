using System.ComponentModel.DataAnnotations;

namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Represents a user in the system
    /// </summary>
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime LastLoginAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<Friend> FriendsInitiated { get; set; } = new List<Friend>();
        public ICollection<Friend> FriendsReceived { get; set; } = new List<Friend>();
        public ICollection<RoomEntity> OwnedRooms { get; set; } = new List<RoomEntity>();
    }
}
