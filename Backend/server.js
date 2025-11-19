const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Almacena las salas activas y su estado
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Manejo de conexiones WebSocket
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('create-room', (username) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      participants: [{
        id: socket.id,
        username: username || 'Anfitrión',
        isHost: true
      }],
      videoState: {
        url: '',
        currentTime: 0,
        isPlaying: false
      }
    };
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    socket.emit('room-created', { roomCode, room });
    console.log(`Room created: ${roomCode}`);
  });

  socket.on('join-room', ({ roomCode, username }) => {
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('room-error', { message: 'Sala no encontrada' });
      return;
    }

    const participant = {
      id: socket.id,
      username: username || `Usuario${room.participants.length + 1}`,
      isHost: false
    };

    room.participants.push(participant);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room-joined', { room });
    io.to(roomCode).emit('participant-joined', { participant, participants: room.participants });
    
    console.log(`User ${username} joined room: ${roomCode}`);
  });

  socket.on('change-video', ({ roomCode, url }) => {
    const room = rooms.get(roomCode);
    
    if (room) {
      room.videoState.url = url;
      room.videoState.currentTime = 0;
      room.videoState.isPlaying = false;
      
      io.to(roomCode).emit('video-changed', { url });
      console.log(`Video changed in room ${roomCode}: ${url}`);
    }
  });

  socket.on('play-video', ({ roomCode, currentTime }) => {
    const room = rooms.get(roomCode);
    
    if (room) {
      room.videoState.isPlaying = true;
      room.videoState.currentTime = currentTime;
      
      socket.to(roomCode).emit('video-play', { currentTime });
      console.log(`Video playing in room ${roomCode} at ${currentTime}s`);
    }
  });

  socket.on('pause-video', ({ roomCode, currentTime }) => {
    const room = rooms.get(roomCode);
    
    if (room) {
      room.videoState.isPlaying = false;
      room.videoState.currentTime = currentTime;
      
      socket.to(roomCode).emit('video-pause', { currentTime });
      console.log(`Video paused in room ${roomCode} at ${currentTime}s`);
    }
  });

  socket.on('seek-video', ({ roomCode, currentTime }) => {
    const room = rooms.get(roomCode);
    
    if (room) {
      room.videoState.currentTime = currentTime;
      
      socket.to(roomCode).emit('video-seek', { currentTime });
      console.log(`Video seeked in room ${roomCode} to ${currentTime}s`);
    }
  });

  socket.on('leave-room', () => {
    handleDisconnect(socket);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    handleDisconnect(socket);
  });

  // Maneja desconexión y limpieza de salas
  function handleDisconnect(socket) {
    const roomCode = socket.roomCode;
    
    if (roomCode) {
      const room = rooms.get(roomCode);
      
      if (room) {
        room.participants = room.participants.filter(p => p.id !== socket.id);
        
        if (room.participants.length === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          if (room.host === socket.id) {
            room.host = room.participants[0].id;
            room.participants[0].isHost = true;
            io.to(roomCode).emit('host-changed', { newHostId: room.host });
          }
          
          io.to(roomCode).emit('participant-left', { 
            participantId: socket.id,
            participants: room.participants 
          });
        }
      }
    }
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  res.json({ exists: !!room });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
