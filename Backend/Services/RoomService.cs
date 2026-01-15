using Microsoft.EntityFrameworkCore;
using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    public class RoomService
    {
        private readonly WatchPartyDbContext _context;
        private readonly FriendService _friendService;

        public RoomService(WatchPartyDbContext context, FriendService friendService)
        {
            _context = context;
            _friendService = friendService;
        }

        public async Task<(bool Success, string? RoomCode, string? Error)> CreateRoomAsync(int userId, string name, string visibility)
        {
            // Validate visibility
            if (visibility != "Public" && visibility != "Private" && visibility != "Friends")
            {
                return (false, null, "Invalid visibility. Must be Public, Private, or Friends");
            }

            // Generate unique room code
            string roomCode;
            do
            {
                roomCode = GenerateRoomCode();
            } while (await _context.Rooms.AnyAsync(r => r.RoomCode == roomCode));

            var room = new RoomEntity
            {
                RoomCode = roomCode,
                OwnerId = userId,
                Name = name,
                Visibility = visibility,
                CreatedAt = DateTime.UtcNow,
                LastActivityAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Rooms.Add(room);
            await _context.SaveChangesAsync();

            return (true, roomCode, null);
        }

        public async Task<List<object>> GetPublicRoomsAsync()
        {
            var rooms = await _context.Rooms
                .Where(r => r.Visibility == "Public" && r.IsActive)
                .Include(r => r.Owner)
                .OrderByDescending(r => r.LastActivityAt)
                .Take(50)
                .ToListAsync();

            return rooms.Select(r => new
            {
                roomCode = r.RoomCode,
                name = r.Name,
                owner = new
                {
                    id = r.Owner.Id,
                    username = r.Owner.Username
                },
                createdAt = r.CreatedAt,
                lastActivityAt = r.LastActivityAt
            }).Cast<object>().ToList();
        }

        public async Task<List<object>> GetFriendRoomsAsync(int userId)
        {
            // Get user's friends
            var friends = await _context.Friends
                .Where(f => (f.UserId == userId || f.FriendUserId == userId) && f.Status == "Accepted")
                .Select(f => f.UserId == userId ? f.FriendUserId : f.UserId)
                .ToListAsync();

            // Get rooms created by friends with "Friends" or "Public" visibility
            var rooms = await _context.Rooms
                .Where(r => friends.Contains(r.OwnerId) &&
                           (r.Visibility == "Friends" || r.Visibility == "Public") &&
                           r.IsActive)
                .Include(r => r.Owner)
                .OrderByDescending(r => r.LastActivityAt)
                .ToListAsync();

            return rooms.Select(r => new
            {
                roomCode = r.RoomCode,
                name = r.Name,
                visibility = r.Visibility,
                owner = new
                {
                    id = r.Owner.Id,
                    username = r.Owner.Username
                },
                createdAt = r.CreatedAt,
                lastActivityAt = r.LastActivityAt
            }).Cast<object>().ToList();
        }

        public async Task<(bool CanJoin, string? Error)> CanUserJoinRoomAsync(int userId, string roomCode)
        {
            var room = await _context.Rooms
                .Include(r => r.Owner)
                .FirstOrDefaultAsync(r => r.RoomCode == roomCode);

            if (room == null)
            {
                return (false, "Room not found");
            }

            if (!room.IsActive)
            {
                return (false, "Room is no longer active");
            }

            // Owner can always join
            if (room.OwnerId == userId)
            {
                return (true, null);
            }

            // Check visibility
            if (room.Visibility == "Public")
            {
                return (true, null);
            }

            if (room.Visibility == "Friends")
            {
                var areFriends = await _friendService.AreFriendsAsync(userId, room.OwnerId);
                if (areFriends)
                {
                    return (true, null);
                }
                return (false, "This is a friends-only room");
            }

            // Private room
            return (false, "This is a private room");
        }

        public async Task UpdateRoomActivityAsync(string roomCode)
        {
            var room = await _context.Rooms.FirstOrDefaultAsync(r => r.RoomCode == roomCode);
            if (room != null)
            {
                room.LastActivityAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        public async Task<RoomEntity?> GetRoomByCodeAsync(string roomCode)
        {
            return await _context.Rooms
                .Include(r => r.Owner)
                .FirstOrDefaultAsync(r => r.RoomCode == roomCode);
        }

        private string GenerateRoomCode()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            return new string(Enumerable.Repeat(chars, 6)
                .Select(s => s[random.Next(s.Length)]).ToArray());
        }
    }
}
