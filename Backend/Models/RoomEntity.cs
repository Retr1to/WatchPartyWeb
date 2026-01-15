using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WatchPartyBackend.Models
{
    /// <summary>
    /// Represents a persistent room in the database
    /// </summary>
    public class RoomEntity
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(64)]
        public string RoomCode { get; set; } = string.Empty;

        [Required]
        public int OwnerId { get; set; }

        [ForeignKey("OwnerId")]
        public User Owner { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Visibility: Public, Private, Friends
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Visibility { get; set; } = "Private";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;

        public bool IsActive { get; set; } = true;
    }
}
