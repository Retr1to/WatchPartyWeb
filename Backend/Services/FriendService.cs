using Microsoft.EntityFrameworkCore;
using WatchPartyBackend.Contracts;
using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    public class FriendService
    {
        private readonly WatchPartyDbContext _context;
        private readonly NotificationManager _notificationManager;

        public FriendService(WatchPartyDbContext context, NotificationManager notificationManager)
        {
            _context = context;
            _notificationManager = notificationManager;
        }

        public async Task<(bool Success, string? Error)> SendFriendRequestAsync(int userId, string friendEmail)
        {
            // Find friend by email
            var normalizedEmail = NormalizeEmail(friendEmail);
            if (string.IsNullOrWhiteSpace(normalizedEmail))
            {
                return (false, "Friend email is required");
            }

            var friendUser = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);
            if (friendUser == null)
            {
                return (false, "User not found");
            }

            if (friendUser.Id == userId)
            {
                return (false, "Cannot send friend request to yourself");
            }

            // Check if already friends or request exists
            var existingFriend = await _context.Friends
                .FirstOrDefaultAsync(f =>
                    (f.UserId == userId && f.FriendUserId == friendUser.Id) ||
                    (f.UserId == friendUser.Id && f.FriendUserId == userId));

            if (existingFriend != null)
            {
                if (existingFriend.Status == "Accepted")
                {
                    return (false, "Already friends");
                }
                return (false, "Friend request already exists");
            }

            // Create friend request
            var friendRequest = new Friend
            {
                UserId = userId,
                FriendUserId = friendUser.Id,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };

            _context.Friends.Add(friendRequest);
            await _context.SaveChangesAsync();

            // Enviar notificación en tiempo real al destinatario
            _ = Task.Run(async () =>
            {
                try
                {
                    var sender = await _context.Users.FindAsync(userId);
                    await _notificationManager.SendToUser(friendUser.Id, new WebSocketMessage
                    {
                        Type = "friend_request_received",
                        Data = new
                        {
                            requestId = friendRequest.Id,
                            from = new
                            {
                                id = sender!.Id,
                                username = sender.Username,
                                email = sender.Email
                            },
                            createdAt = friendRequest.CreatedAt
                        }
                    });
                }
                catch
                {
                    // Ignore notification errors
                }
            });

            return (true, null);
        }

        public async Task<(bool Success, string? Error)> AcceptFriendRequestAsync(int userId, int friendRequestId)
        {
            var friendRequest = await _context.Friends
                .FirstOrDefaultAsync(f => f.Id == friendRequestId && f.FriendUserId == userId && f.Status == "Pending");

            if (friendRequest == null)
            {
                return (false, "Friend request not found");
            }

            friendRequest.Status = "Accepted";
            friendRequest.AcceptedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Enviar notificación al usuario que envió la solicitud
            _ = Task.Run(async () =>
            {
                try
                {
                    var accepter = await _context.Users.FindAsync(userId);
                    await _notificationManager.SendToUser(friendRequest.UserId, new WebSocketMessage
                    {
                        Type = "friend_request_accepted",
                        Data = new
                        {
                            friend = new
                            {
                                id = accepter!.Id,
                                username = accepter.Username,
                                email = accepter.Email
                            }
                        }
                    });
                }
                catch
                {
                    // Ignore notification errors
                }
            });

            return (true, null);
        }

        public async Task<(bool Success, string? Error)> RejectFriendRequestAsync(int userId, int friendRequestId)
        {
            var friendRequest = await _context.Friends
                .FirstOrDefaultAsync(f => f.Id == friendRequestId && f.FriendUserId == userId && f.Status == "Pending");

            if (friendRequest == null)
            {
                return (false, "Friend request not found");
            }

            friendRequest.Status = "Rejected";
            await _context.SaveChangesAsync();

            return (true, null);
        }

        public async Task<List<UserSummary>> GetFriendsAsync(int userId)
        {
            var friends = await _context.Friends
                .Where(f => (f.UserId == userId || f.FriendUserId == userId) && f.Status == "Accepted")
                .Include(f => f.User)
                .Include(f => f.FriendUser)
                .ToListAsync();

            return friends.Select(f =>
            {
                var friend = f.UserId == userId ? f.FriendUser : f.User;
                return new UserSummary
                {
                    Id = friend.Id,
                    Username = friend.Username,
                    Email = friend.Email
                };
            }).ToList();
        }

        public async Task<List<FriendRequestSummary>> GetPendingFriendRequestsAsync(int userId)
        {
            var pendingRequests = await _context.Friends
                .Where(f => f.FriendUserId == userId && f.Status == "Pending")
                .Include(f => f.User)
                .ToListAsync();

            return pendingRequests.Select(f => new FriendRequestSummary
            {
                Id = f.Id,
                From = new UserSummary
                {
                    Id = f.User.Id,
                    Username = f.User.Username,
                    Email = f.User.Email
                },
                CreatedAt = f.CreatedAt
            }).ToList();
        }

        public async Task<bool> AreFriendsAsync(int userId1, int userId2)
        {
            return await _context.Friends
                .AnyAsync(f =>
                    ((f.UserId == userId1 && f.FriendUserId == userId2) ||
                     (f.UserId == userId2 && f.FriendUserId == userId1)) &&
                    f.Status == "Accepted");
        }

        private static string NormalizeEmail(string email)
        {
            return (email ?? string.Empty).Trim().ToLowerInvariant();
        }
    }
}
