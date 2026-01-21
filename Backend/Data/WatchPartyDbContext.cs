using Microsoft.EntityFrameworkCore;

namespace WatchPartyBackend.Models
{
    public class WatchPartyDbContext : DbContext
    {
        public WatchPartyDbContext(DbContextOptions<WatchPartyDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Friend> Friends { get; set; }
        public DbSet<RoomEntity> Rooms { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure User entity
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.Email).IsUnique();
                entity.HasIndex(u => u.Username).IsUnique();
            });

            // Configure Friend entity relationships
            modelBuilder.Entity<Friend>(entity =>
            {
                entity.HasOne(f => f.User)
                    .WithMany(u => u.FriendsInitiated)
                    .HasForeignKey(f => f.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(f => f.FriendUser)
                    .WithMany(u => u.FriendsReceived)
                    .HasForeignKey(f => f.FriendUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(f => new { f.UserId, f.FriendUserId }).IsUnique();
            });

            // Configure RoomEntity
            modelBuilder.Entity<RoomEntity>(entity =>
            {
                entity.HasIndex(r => r.RoomCode).IsUnique();

                entity.HasOne(r => r.Owner)
                    .WithMany(u => u.OwnedRooms)
                    .HasForeignKey(r => r.OwnerId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
