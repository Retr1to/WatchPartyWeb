using Microsoft.EntityFrameworkCore;
using WatchPartyBackend.Models;

namespace WatchPartyBackend.Services
{
    public class FriendService
    {
        private readonly WatchPartyDbContext _context;

        public FriendService(WatchPartyDbContext context)
        {
            _context = context;
        }

        public async Task<(bool Success, string? Error)> SendFriendRequestAsync(int userId, string friendEmail)
        {
            // Find friend by email
            var friendUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == friendEmail);
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

        public async Task<List<object>> GetFriendsAsync(int userId)
        {
            var friends = await _context.Friends
                .Where(f => (f.UserId == userId || f.FriendUserId == userId) && f.Status == "Accepted")
                .Include(f => f.User)
                .Include(f => f.FriendUser)
                .ToListAsync();

            return friends.Select(f =>
            {
                var friend = f.UserId == userId ? f.FriendUser : f.User;
                return new
                {
                    id = friend.Id,
                    username = friend.Username,
                    email = friend.Email
                };
            }).Cast<object>().ToList();
        }

        public async Task<List<object>> GetPendingFriendRequestsAsync(int userId)
        {
            var pendingRequests = await _context.Friends
                .Where(f => f.FriendUserId == userId && f.Status == "Pending")
                .Include(f => f.User)
                .ToListAsync();

            return pendingRequests.Select(f => new
            {
                id = f.Id,
                from = new
                {
                    id = f.User.Id,
                    username = f.User.Username,
                    email = f.User.Email
                },
                createdAt = f.CreatedAt
            }).Cast<object>().ToList();
        }

        public async Task<bool> AreFriendsAsync(int userId1, int userId2)
        {
            return await _context.Friends
                .AnyAsync(f =>
                    ((f.UserId == userId1 && f.FriendUserId == userId2) ||
                     (f.UserId == userId2 && f.FriendUserId == userId1)) &&
                    f.Status == "Accepted");
        }
    }
}
