# Quick Start Guide - WatchTogether

## 🚀 Getting Started in 3 Easy Steps

### Option 1: One-Click Start (Recommended for Windows)
Simply double-click `start-all.bat` in the root directory. This will:
- Install all dependencies automatically
- Start the backend server
- Start the frontend server
- Open two command windows

### Option 2: Manual Start

#### Step 1: Start the Backend
Open a terminal in the project root and run:
```bash
cd Backend
npm install
npm start
```
✅ Backend running at http://localhost:3000

#### Step 2: Start the Frontend
Open another terminal in the project root and run:
```bash
cd Frontend
npm install
npm start
```
✅ Frontend running at http://localhost:4200

#### Step 3: Open Your Browser
Navigate to http://localhost:4200

## 📖 Usage Guide

### Create a New Watch Party
1. Open http://localhost:4200
2. (Optional) Enter your name
3. Click "✨ Crear Sala Nueva"
4. Share the room code with friends (e.g., "7D624")

### Join a Watch Party
1. Get the room code from a friend
2. (Optional) Enter your name
3. Click "Unirse a Sala"
4. Enter the room code
5. Click "Unirse"

### Watch Videos Together
1. In the room, click "Cambiar Video / URL"
2. Paste a video URL (direct link to .mp4, .webm, etc.)
3. Click "Cargar Video"
4. Use the video controls - they sync for everyone!

## 🎬 Where to Find Videos

### Sample Video URLs (for testing):
- Sample 1: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
- Sample 2: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`
- Sample 3: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4`

### Finding Your Own Videos:
- Direct video file URLs (.mp4, .webm, .ogg)
- Some cloud storage services with public links
- Personal video hosting

**Note:** YouTube, Netflix, and other streaming platforms are not supported (they require special integration).

## 🎨 Features to Try

- ✅ Create multiple rooms simultaneously
- ✅ Join the same room from different browsers/devices
- ✅ Test video synchronization (play, pause, seek)
- ✅ See participants update in real-time
- ✅ Copy room code with one click
- ✅ Test responsive design on mobile

## ⚠️ Troubleshooting

### "Cannot connect to server"
- Make sure the backend is running on port 3000
- Check for error messages in the backend terminal

### "Video won't load"
- Ensure the URL is a direct link to a video file
- Check if the video source allows CORS
- Try one of the sample URLs above

### Port Already in Use
- Close other applications using ports 3000 or 4200
- Or modify the port in the configuration files

## 🛠️ Development Tips

### Backend Changes
The backend uses nodemon for development:
```bash
cd Backend
npm run dev
```
Changes will auto-reload.

### Frontend Changes
Angular hot-reloads automatically. Just save your files and see changes instantly.

### Testing with Multiple Users
- Open multiple browser windows/tabs
- Use different browsers (Chrome, Firefox, Edge)
- Use private/incognito mode for separate sessions

## 📝 Example Testing Flow

1. **User 1**: Creates room → Gets code "ABC123"
2. **User 2**: Joins room "ABC123"
3. **User 1**: Loads video URL
4. **Both Users**: See the same video
5. **User 2**: Presses play
6. **Both Users**: Video plays in sync
7. **User 1**: Seeks forward
8. **Both Users**: Video jumps to new time

## 🎯 Next Steps

Once you're comfortable with the basics:
- Try hosting on a local network and access from other devices
- Customize the styling in the `.css` files
- Add new features to the backend/frontend
- Deploy to a hosting service for remote access

## 💡 Pro Tips

- The room code is case-insensitive
- The first person in the room becomes the host
- If the host leaves, a new host is automatically assigned
- Room codes are 6 characters (letters and numbers)
- Rooms are automatically deleted when everyone leaves

Enjoy watching together! 🎉
