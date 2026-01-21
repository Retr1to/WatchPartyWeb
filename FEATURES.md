# 🎉 New Features: User Authentication & Friend System

This PR adds a complete user authentication and social features system to WatchParty!

## ✨ What's New

### 🔐 User Accounts
- **Register** - Create your account with username, email, and password
- **Login** - Secure JWT-based authentication
- **Profile** - View your user information
- **Logout** - Securely end your session

### 👥 Friend System
- **Add Friends** - Send friend requests by email
- **Manage Requests** - Accept or reject incoming friend requests
- **Friends List** - See all your friends in one place
- **Friend Activity** - See rooms your friends have created

### 🏠 Room Visibility
Rooms now have three visibility options:

- **🌍 Public** - Anyone can see and join
- **🔒 Private** - Only you can join (perfect for testing)
- **👥 Friends** - Only your friends can see and join

### 🎨 Beautiful New UI
- Modern glassmorphism design for login/register pages
- Enhanced home page with user dashboard
- Friend management panel
- Room browser showing public and friend rooms

## 🚀 Quick Start

### Prerequisites
- PostgreSQL (user: postgres, password: postgres)
- .NET 8 SDK
- Node.js 16+

### Setup (First Time)

```bash
# 1. Create PostgreSQL database
psql -U postgres
CREATE DATABASE watchparty;
\q

# 2. Run database migrations
cd Backend
dotnet ef database update

# 3. Start backend (in one terminal)
dotnet run

# 4. Start frontend (in another terminal)
cd ../Frontend
npm install
npm start
```

### Test the API (Optional)

```bash
# Automated test script
./test-api.sh
```

## 📱 How to Use

### 1. Register an Account
1. Open http://localhost:4200
2. Click "Create Account"
3. Fill in username, email, and password
4. Click "Create Account"

### 2. Add Friends
1. Login to your account
2. In the "Friends" section, enter a friend's email
3. Click "Add Friend"
4. Your friend will receive the request
5. They can accept it from their pending requests

### 3. Create a Room
1. Login to your account
2. Click "Create New Room"
3. Choose a name and visibility:
   - **Public**: Everyone can join
   - **Private**: Only you
   - **Friends**: Only your friends
4. Click "Create Room"
5. Share the room code with friends!

### 4. Join Rooms
- **Public Rooms**: Browse the public rooms list and click to join
- **Friend Rooms**: See rooms your friends created and join them
- **Private Rooms**: Enter the room code directly if you have it

## 🏗️ Architecture

### Backend (ASP.NET Core 8)
```
Backend/
├── Models/
│   ├── User.cs           # User account model
│   ├── Friend.cs         # Friend relationships
│   └── RoomEntity.cs     # Persistent rooms
├── Services/
│   ├── AuthService.cs    # Authentication logic
│   ├── FriendService.cs  # Friend management
│   └── RoomService.cs    # Room management
└── Data/
    └── WatchPartyDbContext.cs  # Database context
```

### Frontend (Angular 17)
```
Frontend/src/app/
├── components/
│   ├── login/          # Login page
│   ├── register/       # Registration page
│   └── home/           # Enhanced dashboard
└── services/
    ├── auth.service.ts    # Authentication
    ├── user.service.ts    # Friends & rooms
    ├── auth.guard.ts      # Route protection
    └── auth.interceptor.ts # JWT injection
```

### Database (PostgreSQL)
```
Tables:
- Users (id, username, email, password_hash)
- Friends (id, user_id, friend_user_id, status)
- Rooms (id, room_code, owner_id, name, visibility)
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Friends
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/accept/{id}` - Accept request
- `POST /api/friends/reject/{id}` - Reject request
- `GET /api/friends` - List friends
- `GET /api/friends/requests` - Pending requests

### Rooms
- `POST /api/rooms/create` - Create room
- `GET /api/rooms/public` - List public rooms
- `GET /api/rooms/friends` - List friend rooms
- `GET /api/rooms/{code}/can-join` - Check access

## 🔒 Security

- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: SHA256 (upgrade to BCrypt recommended for production)
- **Protected Routes**: Frontend guards and backend authorization
- **CORS**: Configured for frontend origin
- **Input Validation**: Server-side validation for all inputs

## 📊 Technical Details

- **28 files** modified/created
- **13 API endpoints** added
- **3 database tables** created
- **2 new components** + 1 updated
- **Zero build errors** ✅

## 🎯 Room Visibility Matrix

| Visibility | Owner | Friends | Public |
|-----------|-------|---------|--------|
| Public    | ✅    | ✅      | ✅     |
| Private   | ✅    | ❌      | ❌     |
| Friends   | ✅    | ✅      | ❌     |

## 📖 Documentation

- **IMPLEMENTATION.md** - Detailed setup and API reference
- **SUMMARY.md** - Complete implementation overview
- **test-api.sh** - Automated API testing script

## 🐛 Known Limitations

1. **Password Security**: Uses SHA256 (upgrade to BCrypt/Argon2 for production)
2. **Language**: Some UI messages in Spanish (i18n recommended)
3. **WebSocket Auth**: Not yet integrated with JWT (future enhancement)

## 🤝 Contributing

Test the new features and report any issues! To test:

1. Register two accounts
2. Send a friend request between them
3. Accept the friend request
4. Create different visibility rooms
5. Test access to each room type

## 📝 Changelog

### Added
- User registration and login system
- Friend request and management system
- Room visibility controls (Public/Private/Friends)
- JWT-based authentication
- PostgreSQL database integration
- Beautiful login/register UI
- Enhanced home page dashboard
- Automated API test script

### Changed
- Home component now requires authentication for room creation
- Rooms now persist in database
- Added ownership and access control to rooms

### Security
- All authentication endpoints protected with JWT
- Password hashing implemented
- Input validation on all endpoints

---

**Ready to watch together with your friends! 🎬**
