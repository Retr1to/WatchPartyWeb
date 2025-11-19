# WatchTogether - WatchParty Web Application

A real-time video watch party application that allows users to watch videos together in synchronized rooms using WebSockets.

## Features

- 🎥 **Real-time Video Synchronization**: Watch videos together with friends with synchronized playback
- 🔄 **WebSocket Communication**: Instant synchronization using Socket.io
- 👥 **Participant Management**: See who's in the room and track the host
- 🎬 **Video URL Support**: Load any video URL to watch together
- 📱 **Responsive Design**: Beautiful purple gradient UI that works on all devices
- 🎨 **Modern UI**: Clean and intuitive interface inspired by modern streaming platforms

## Technology Stack

### Backend
- **Node.js** with Express
- **Socket.io** for WebSocket connections
- **CORS** enabled for cross-origin requests

### Frontend
- **Angular 17** (Standalone components)
- **Socket.io-client** for real-time communication
- **TypeScript**
- **Responsive CSS** with gradient design

## Project Structure

```
WatchPartyWeb/
├── Backend/
│   ├── server.js          # Express + Socket.io server
│   ├── package.json       # Backend dependencies
│   └── .gitignore
│
├── Frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── home/           # Home page (create/join room)
│   │   │   │   └── room/           # Room page (video player)
│   │   │   ├── services/
│   │   │   │   └── socket.service.ts  # WebSocket service
│   │   │   ├── app.component.ts
│   │   │   └── app.routes.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the Backend directory:
```bash
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The backend server will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to the Frontend directory:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the Angular development server:
```bash
npm start
```

The frontend will be available at `http://localhost:4200`

## How to Use

### Creating a Room

1. Open the application at `http://localhost:4200`
2. (Optional) Enter your username
3. Click **"✨ Crear Sala Nueva"** (Create New Room)
4. Share the generated room code with friends

### Joining a Room

1. Get the room code from a friend
2. (Optional) Enter your username
3. Click **"Unirse a Sala"** (Join Room)
4. Enter the room code
5. Click **"Unirse"** (Join)

### Watching Videos Together

1. Once in a room, click **"Cambiar Video / URL"**
2. Paste a video URL (must be a direct video link, e.g., .mp4, .webm)
3. Click **"Cargar Video"**
4. All participants will see the video and can control playback
5. Playback is synchronized across all participants

### Features in the Room

- **Video Player**: HTML5 video player with standard controls
- **Participant List**: See all users in the room
- **Host Badge**: The room creator has a special "Anfitrión" badge
- **Copy Room Code**: Click the 📋 icon to copy the room code
- **Exit Room**: Click "Salir" to leave the room

## WebSocket Events

### Client → Server
- `create-room`: Create a new room
- `join-room`: Join an existing room
- `change-video`: Change the video source
- `play-video`: Play the video
- `pause-video`: Pause the video
- `seek-video`: Seek to a specific time
- `leave-room`: Leave the room

### Server → Client
- `room-created`: Room successfully created
- `room-joined`: Successfully joined a room
- `room-error`: Error (e.g., room not found)
- `participant-joined`: New participant joined
- `participant-left`: Participant left
- `video-changed`: Video source changed
- `video-play`: Video started playing
- `video-pause`: Video paused
- `video-seek`: Video time changed
- `host-changed`: New host assigned

## API Endpoints

### GET `/api/rooms/:code`
Check if a room exists
- **Response**: `{ exists: boolean }`

## Development

### Running in Development Mode

**Backend (with auto-restart):**
```bash
cd Backend
npm run dev  # Requires nodemon
```

**Frontend:**
```bash
cd Frontend
npm start
```

### Building for Production

**Frontend:**
```bash
cd Frontend
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Troubleshooting

### Port Already in Use
- Backend: Change the `PORT` in `Backend/server.js`
- Frontend: Use `ng serve --port 4201` to use a different port

### Connection Issues
- Ensure backend is running on port 3000
- Check CORS configuration in `Backend/server.js`
- Verify Socket.io connection URL in `Frontend/src/app/services/socket.service.ts`

### Video Not Loading
- Ensure the video URL is a direct link to a video file
- Check if the video source supports CORS
- Try using different video formats (.mp4, .webm)

## Future Enhancements

- 🎤 Voice chat integration
- 💬 Text chat within rooms
- 🎨 Theme customization
- 📺 YouTube and other platform integrations
- 🔐 Room passwords
- 📊 Room statistics and history
- 🌐 User accounts and profiles

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.