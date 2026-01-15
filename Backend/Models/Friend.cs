using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Represents a friend relationship between two users
    /// </summary>
    public class Friend
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        public int FriendUserId { get; set; }

        [ForeignKey("FriendUserId")]
        public User FriendUser { get; set; } = null!;

        /// <summary>
        /// Status: Pending, Accepted, Rejected
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? AcceptedAt { get; set; }
    }
}
