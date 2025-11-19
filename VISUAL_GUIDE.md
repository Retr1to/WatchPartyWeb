# 🎬 WatchTogether - Visual Quick Reference

## 🖼️ What You'll See

### Home Page - http://localhost:4200
```
╔════════════════════════════════════════╗
║                                        ║
║         [🎥 Purple Icon Box]          ║
║                                        ║
║         WatchTogether                  ║
║    Ve videos con tus amigos en         ║
║           tiempo real                  ║
║                                        ║
║    ┌──────────────────────────────┐   ║
║    │ Tu nombre (opcional)         │   ║
║    └──────────────────────────────┘   ║
║                                        ║
║    ┌──────────────────────────────┐   ║
║    │ ✨ Crear Sala Nueva         │   ║ ← Click to create
║    └──────────────────────────────┘   ║
║                                        ║
║                o                       ║
║                                        ║
║    ┌──────────────────────────────┐   ║
║    │     Unirse a Sala            │   ║ ← Click to join
║    └──────────────────────────────┘   ║
║                                        ║
╚════════════════════════════════════════╝
```

### Room Page - http://localhost:4200/room/ABC123
```
╔═══════════════════════════════════════════════════════════════╗
║  📹 ABC123 [📋]                             [Salir]           ║
╠═══════════════════════════════════════╦═══════════════════════╣
║                                       ║                       ║
║  ┌─────────────────────────────────┐ ║  👥 Participantes (2) ║
║  │                                 │ ║                       ║
║  │   [Video Playing or Placeholder]│ ║  ┌─────────────────┐ ║
║  │                                 │ ║  │ Anfitrión       │ ║
║  │         16:9 Video Player       │ ║  │ [Alice] 👑      │ ║
║  │                                 │ ║  └─────────────────┘ ║
║  └─────────────────────────────────┘ ║                       ║
║  [▶] ━━━━━━━━━━━━━━━━━━━ [🔊] [⚙] ║  ┌─────────────────┐ ║
║  2:34                         7:28   ║  │ Bob             │ ║
║                                       ║  └─────────────────┘ ║
║  ┌───────────────────────────────┐   ║                       ║
║  │ 🎬 Fuente de Video            │   ║                       ║
║  ├───────────────────────────────┤   ║                       ║
║  │ https://video.mp4             │   ║                       ║
║  │ [Cambiar Video / URL]         │   ║                       ║
║  └───────────────────────────────┘   ║                       ║
║                                       ║                       ║
╚═══════════════════════════════════════╩═══════════════════════╝
```

---

## 🎮 User Actions

### 1️⃣ Create a Room
```
User Action:           System Response:
                      
1. Open app            → Show home page
                      
2. [Optional] Type     → Store username
   "Alice"            
                      
3. Click "Crear Sala"  → Generate code (ABC123)
                       → Navigate to /room/ABC123
                       → Show video room
                      
4. Share "ABC123"      → Friends can join!
```

### 2️⃣ Join a Room
```
User Action:           System Response:
                      
1. Get code "ABC123"   → From friend
   from friend        
                      
2. Click "Unirse"      → Open modal dialog
                      
3. Type "ABC123"       → Auto-uppercase
                      
4. [Optional] Type     → Store username
   "Bob"              
                      
5. Click "Unirse"      → Verify room exists
                       → Join room
                       → Navigate to /room/ABC123
                       → Update all participants
```

### 3️⃣ Load a Video
```
User Action:           System Response:
                      
1. In room, click      → Show input field
   "Cambiar Video"    
                      
2. Paste video URL     → Store in input
                      
3. Click "Cargar"      → Broadcast to server
                       → Update all clients
                       → Load video for everyone
                      
4. Video appears       → Ready to play!
```

### 4️⃣ Watch Together
```
User Action:           System Response:
                      
Alice clicks [▶]       → Video plays for Alice
                       → Broadcast play event
                       → Video plays for Bob
                       → Videos synchronized
                      
Bob clicks [⏸]         → Video pauses for Bob
                       → Broadcast pause event
                       → Video pauses for Alice
                       → Videos synchronized
                      
Alice drags timeline   → Seek to 1:30 for Alice
to 1:30               → Broadcast seek event
                       → Seek to 1:30 for Bob
                       → Videos synchronized
```

---

## 🎯 What Each Button Does

### Home Page
| Button | Action | Result |
|--------|--------|--------|
| ✨ Crear Sala Nueva | Creates new room | Generates code, navigates to room |
| Unirse a Sala | Opens join dialog | Shows room code input |
| [Modal] Unirse | Joins room | Connects to room or shows error |
| [Modal] Cancelar | Closes dialog | Returns to home page |

### Room Page
| Button/Action | Function | Effect |
|---------------|----------|--------|
| 📋 Copy | Copies room code | Code in clipboard |
| Salir | Leaves room | Returns to home |
| Cambiar Video / URL | Opens video input | Shows URL field |
| Cargar Video | Loads new video | All users see new video |
| Cancelar | Cancels video change | Hides input |
| ▶ Play | Plays video | All users' videos play |
| ⏸ Pause | Pauses video | All users' videos pause |
| 🔊 Volume | Controls volume | Local only |
| ⚙️ Settings | Video settings | Local only |
| Timeline drag | Seeks video | All users seek to time |

---

## 🎨 Color Guide

### Purple Gradient Background
- Start: `#667eea` (Indigo)
- End: `#764ba2` (Purple)
- Used: App background

### Pink Gradient (Primary Action)
- Start: `#ec4899` (Pink)
- End: `#f97316` (Orange)
- Used: "Crear Sala Nueva" button, Host badge

### Purple Gradient (Secondary)
- Start: `#a78bfa` (Light Purple)
- End: `#ec4899` (Pink)
- Used: Icon box, "Cambiar Video" button

### Glass Effect
- Background: `rgba(255, 255, 255, 0.1)`
- Backdrop: `blur(10px)`
- Border: `rgba(255, 255, 255, 0.2)`
- Used: All cards and panels

---

## 📱 Screen Sizes

### Desktop (1024px+)
```
┌─────────────────────────────────────────┐
│              Full Width                 │
│  ┌───────────────────┬────────────────┐ │
│  │                   │                │ │
│  │   Video Section   │  Participants  │ │
│  │                   │                │ │
│  └───────────────────┴────────────────┘ │
└─────────────────────────────────────────┘
```

### Tablet (768px - 1024px)
```
┌─────────────────────────────────────┐
│         Adjusted Width              │
│  ┌─────────────────────────────┐   │
│  │     Video Section           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │     Participants            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌─────────────────────┐
│   Full Width        │
│  ┌───────────────┐  │
│  │   Video       │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Participants  │  │
│  └───────────────┘  │
└─────────────────────┘
```

---

## 🔔 Real-Time Updates

### What Syncs Automatically
✅ Video play/pause state  
✅ Video current time position  
✅ Participant list  
✅ Host badge  
✅ Video URL changes  

### What Doesn't Sync
❌ Volume levels (user preference)  
❌ Video quality settings (local)  
❌ Fullscreen mode (browser control)  

---

## ⚡ Quick Tips

### 💡 Pro Tips
1. **Room Code**: Can be any 6 characters (auto-generated)
2. **Username**: Optional, defaults to "Anfitrión" or "Usuario"
3. **Copy Code**: Click 📋 icon to quickly copy room code
4. **Host Badge**: Pink "Anfitrión" badge shows room creator
5. **Auto-Sync**: All video controls sync automatically
6. **Multiple Rooms**: Open different rooms in different tabs
7. **Mobile**: Works great on phones and tablets

### ⚠️ Remember
- Room codes are case-insensitive
- Rooms delete when last person leaves
- First person becomes host
- Host transfers if original host leaves
- Video must be direct URL (.mp4, .webm, etc.)
- CORS-enabled videos work best

---

## 🎬 Sample Scenarios

### Scenario 1: Movie Night with Friends
```
1. Alice creates room → Gets code "MOV123"
2. Bob joins "MOV123"
3. Carol joins "MOV123"
4. Alice loads movie trailer URL
5. Everyone watches together
6. Anyone can pause/play/seek
7. All stay perfectly synced
```

### Scenario 2: Study Group
```
1. Student creates room → Gets code "STU456"
2. Shares code in group chat
3. 5 students join
4. Load educational video
5. Watch lecture together
6. Everyone can control playback
7. Discuss in separate chat app
```

### Scenario 3: Remote Watch Party
```
1. Host creates room → Gets code "PARTY1"
2. Friends across the world join
3. Load comedy special
4. Watch and laugh together
5. Synchronized experience despite distance
```

---

## 📊 What's Happening Behind the Scenes

```
When you click PLAY:
User Browser → WebSocket → Server → WebSocket → Other Users
     ▲                                               │
     │                                               ▼
   Your video plays                        Their videos play

All in milliseconds! ⚡
```

---

## 🎯 Success Indicators

### ✅ Everything is Working When:
- Purple gradient background shows
- Room code appears in header
- Participant list updates when someone joins
- Video controls appear
- Video plays/pauses for everyone
- Timeline seeks sync across users
- Copy button works
- Exit returns to home

### ❌ Something is Wrong If:
- Can't connect to room
- Video won't load
- Controls don't sync
- Participant list doesn't update
- See error messages

→ Check [TESTING.md](TESTING.md) for solutions

---

## 🚀 Ready to Start!

1. **Double-click** `start-all.bat`
2. **Wait** for both servers to start
3. **Open** http://localhost:4200
4. **Create** a room
5. **Share** the code
6. **Watch** together!

That's it! Enjoy your watch party! 🎉

---

**Need help?** Check [INDEX.md](INDEX.md) for links to all documentation.
