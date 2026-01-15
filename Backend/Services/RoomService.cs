using Microsoft.EntityFrameworkCore;
using WatchPartyBackend.Contracts;
using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    public class RoomService
    {
        private readonly WatchPartyDbContext _context;
        private readonly FriendService _friendService;
        private readonly NotificationManager _notificationManager;

        public RoomService(WatchPartyDbContext context, FriendService friendService, NotificationManager notificationManager)
        {
            _context = context;
            _friendService = friendService;
            _notificationManager = notificationManager;
        }

        public async Task<(bool Success, string? RoomCode, string? Error)> CreateRoomAsync(int userId, string name, string visibility)
        {
            var normalizedName = NormalizeRoomName(name);
            var normalizedVisibility = NormalizeVisibility(visibility);

            // Validate visibility
            if (normalizedVisibility == null)
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
                Name = normalizedName,
                Visibility = normalizedVisibility,
                CreatedAt = DateTime.UtcNow,
                LastActivityAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.Rooms.Add(room);
            await _context.SaveChangesAsync();

            // Notificar a los amigos si la sala es de tipo "Friends" o "Public"
            if (normalizedVisibility == "Friends" || normalizedVisibility == "Public")
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var owner = await _context.Users.FindAsync(userId);
                        var friends = await _context.Friends
                            .Where(f => (f.UserId == userId || f.FriendUserId == userId) && f.Status == "Accepted")
                            .Select(f => f.UserId == userId ? f.FriendUserId : f.UserId)
                            .ToListAsync();

                        if (friends.Any())
                        {
                            await _notificationManager.SendToUsers(friends, new WebSocketMessage
                            {
                                Type = "new_room_created",
                                Data = new
                                {
                                    roomCode,
                                    name = normalizedName,
                                    visibility = normalizedVisibility,
                                    owner = new
                                    {
                                        id = owner!.Id,
                                        username = owner.Username
                                    },
                                    createdAt = room.CreatedAt
                                }
                            });
                        }
                    }
                    catch
                    {
                        // Ignore notification errors
                    }
                });
            }

            return (true, roomCode, null);
        }

        public async Task<List<RoomSummary>> GetPublicRoomsAsync()
        {
            var rooms = await _context.Rooms
                .Where(r => r.Visibility == "Public" && r.IsActive)
                .Include(r => r.Owner)
                .OrderByDescending(r => r.LastActivityAt)
                .Take(50)
                .ToListAsync();

            return rooms.Select(r => new RoomSummary
            {
                RoomCode = r.RoomCode,
                Name = r.Name,
                Visibility = r.Visibility,
                Owner = new UserSummary
                {
                    Id = r.Owner.Id,
                    Username = r.Owner.Username,
                    Email = r.Owner.Email
                },
                CreatedAt = r.CreatedAt,
                LastActivityAt = r.LastActivityAt
            }).ToList();
        }

        public async Task<List<RoomSummary>> GetFriendRoomsAsync(int userId)
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

            return rooms.Select(r => new RoomSummary
            {
                RoomCode = r.RoomCode,
                Name = r.Name,
                Visibility = r.Visibility,
                Owner = new UserSummary
                {
                    Id = r.Owner.Id,
                    Username = r.Owner.Username,
                    Email = r.Owner.Email
                },
                CreatedAt = r.CreatedAt,
                LastActivityAt = r.LastActivityAt
            }).ToList();
        }

        public async Task<(bool CanJoin, string? Error)> CanUserJoinRoomAsync(int userId, string roomCode)
        {
            var normalizedRoomCode = NormalizeRoomCode(roomCode);
            if (string.IsNullOrWhiteSpace(normalizedRoomCode))
            {
                return (false, "Room code is required");
            }

            var room = await _context.Rooms
                .Include(r => r.Owner)
                .FirstOrDefaultAsync(r => r.RoomCode == normalizedRoomCode);

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

        public async Task DeactivateRoomAsync(string roomCode)
        {
            var room = await _context.Rooms.FirstOrDefaultAsync(r => r.RoomCode == roomCode);
            if (room != null && room.IsActive)
            {
                room.IsActive = false;
                room.LastActivityAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                Console.WriteLine($"[{DateTime.UtcNow:HH:mm:ss}] Room {roomCode} marked as inactive in database");
            }
        }

        public async Task<RoomEntity?> GetRoomByCodeAsync(string roomCode)
        {
            var normalizedRoomCode = NormalizeRoomCode(roomCode);
            if (string.IsNullOrWhiteSpace(normalizedRoomCode))
            {
                return null;
            }

            return await _context.Rooms
                .Include(r => r.Owner)
                .FirstOrDefaultAsync(r => r.RoomCode == normalizedRoomCode);
        }

        private string GenerateRoomCode()
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            var random = new Random();
            return new string(Enumerable.Repeat(chars, 6)
                .Select(s => s[random.Next(s.Length)]).ToArray());
        }

        internal static string NormalizeRoomCode(string roomCode)
        {
            return (roomCode ?? string.Empty).Trim().ToUpperInvariant();
        }

        internal static string NormalizeRoomName(string name)
        {
            var trimmed = (name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                return "My Room";
            }

            if (trimmed.Length > 100)
            {
                trimmed = trimmed[..100];
            }

            return trimmed;
        }

        internal static string? NormalizeVisibility(string visibility)
        {
            var trimmed = (visibility ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(trimmed))
            {
                return "Private";
            }

            return trimmed.ToLowerInvariant() switch
            {
                "public" => "Public",
                "private" => "Private",
                "friends" => "Friends",
                _ => null
            };
        }
    }
}
