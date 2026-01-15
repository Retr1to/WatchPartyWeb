# User Authentication & Friend System Implementation

This document describes the implementation of user authentication, friend management, and room visibility features for WatchParty.

## Features Implemented

### Backend (ASP.NET Core)

1. **Database Models**
   - `User`: Stores user information (username, email, hashed password)
   - `Friend`: Manages friend relationships between users
   - `RoomEntity`: Persistent rooms with ownership and visibility settings

2. **Authentication**
   - JWT-based authentication
   - Password hashing using SHA256
   - Registration and login endpoints
   - Protected API endpoints

3. **Friend System**
   - Send friend requests by email
   - Accept/reject friend requests
   - List friends
   - List pending friend requests

4. **Room Management**
   - Create rooms with visibility (Public, Private, Friends)
   - List public rooms
   - List friend rooms (rooms created by friends)
   - Check if user can join a room based on visibility

### Frontend (Angular 17)

1. **Authentication Services**
   - `AuthService`: Handle registration, login, logout, token management
   - `UserService`: Friend and room management
   - `authInterceptor`: Automatically add JWT token to HTTP requests
   - `authGuard`: Protect routes requiring authentication

2. **Components**
   - `LoginComponent`: User login form
   - `RegisterComponent`: User registration form
   - Updated `HomeComponent`: Shows different UI for authenticated/unauthenticated users

3. **Features**
   - Login/Register with JWT tokens
   - Friend management (add, accept, reject, list)
   - View public rooms
   - View friend rooms
   - Create rooms with visibility settings
   - Logout functionality

## Database Setup

### Prerequisites
- PostgreSQL installed and running
- Database: `watchparty`
- User: `postgres`
- Password: `postgres`

### Creating the Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE watchparty;

# Exit
\q
```

### Running Migrations

```bash
cd Backend
dotnet ef database update
```

This will create the following tables:
- `Users`
- `Friends`
- `Rooms`

## Running the Application

### Backend

```bash
cd Backend
dotnet run
```

The backend will start on `http://localhost:5000` (or the port specified in environment)

### Frontend

```bash
cd Frontend
npm install
npm start
```

The frontend will start on `http://localhost:4200`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
  ```json
  {
    "username": "john",
    "email": "john@example.com",
    "password": "password123"
  }
  ```

- `POST /api/auth/login` - Login
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```

- `GET /api/auth/me` - Get current user (requires auth)

### Friends

- `POST /api/friends/request` - Send friend request (requires auth)
  ```json
  {
    "email": "friend@example.com"
  }
  ```

- `POST /api/friends/accept/{requestId}` - Accept friend request (requires auth)
- `POST /api/friends/reject/{requestId}` - Reject friend request (requires auth)
- `GET /api/friends` - Get friends list (requires auth)
- `GET /api/friends/requests` - Get pending requests (requires auth)

### Rooms

- `POST /api/rooms/create` - Create room (requires auth)
  ```json
  {
    "name": "My Room",
    "visibility": "Public"
  }
  ```
  
  Visibility options: `Public`, `Private`, `Friends`

- `GET /api/rooms/public` - Get public rooms
- `GET /api/rooms/friends` - Get friend rooms (requires auth)
- `GET /api/rooms/{roomCode}/can-join` - Check if user can join room (requires auth)

## Configuration

### Backend Configuration (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=watchparty;Username=postgres;Password=postgres"
  },
  "JWT_SECRET": "your-super-secret-key-change-in-production-min-32-chars"
}
```

### Environment Variables

- `DATABASE_URL`: Override database connection string
- `JWT_SECRET`: Override JWT secret key
- `PORT`: Override server port

### Frontend Configuration

Update API URL in services if needed:
- `Frontend/src/app/services/auth.service.ts`
- `Frontend/src/app/services/user.service.ts`

Change `apiUrl` from `http://localhost:5000/api` to your backend URL.

## Testing the Implementation

### 1. Register Users

```bash
# Register first user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123"
  }'

# Register second user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bob",
    "email": "bob@example.com",
    "password": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "password123"
  }'
```

Save the returned token for subsequent requests.

### 3. Send Friend Request

```bash
TOKEN="your-jwt-token-here"

curl -X POST http://localhost:5000/api/friends/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@example.com"
  }'
```

### 4. Create Room

```bash
curl -X POST http://localhost:5000/api/rooms/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Movie Night",
    "visibility": "Public"
  }'
```

### 5. Get Public Rooms

```bash
curl http://localhost:5000/api/rooms/public
```

## Security Considerations

1. **Password Hashing**: Currently using SHA256. For production, consider using bcrypt or Argon2.
2. **JWT Secret**: Change the default JWT secret in production.
3. **HTTPS**: Enable HTTPS in production.
4. **CORS**: Configure CORS properly for your frontend domain.
5. **Input Validation**: Additional validation rules can be added as needed.

## Room Visibility Rules

- **Public**: Anyone can see and join
- **Private**: Only the owner can join (for invite-only scenarios)
- **Friends**: Only friends of the room owner can see and join

## Future Enhancements

- Email verification
- Password reset functionality
- Remove friend functionality
- Block user functionality
- Room invitations
- Room passwords
- User profiles with avatars
- Online status indicators
