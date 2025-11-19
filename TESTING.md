# Testing & Demo Guide

## 🧪 Complete Testing Guide

### Prerequisites
- Node.js installed
- Two terminal windows
- Modern web browser (Chrome, Firefox, Edge)

---

## 🚀 Step-by-Step Setup & Testing

### Phase 1: Installation (First Time Only)

#### Backend Setup
```powershell
cd Backend
npm install
```

Expected output:
```
added 50 packages, and audited 51 packages in 5s
```

#### Frontend Setup
```powershell
cd Frontend
npm install
```

Expected output:
```
added 1000+ packages, and audited 1200 packages in 45s
```

---

### Phase 2: Starting the Servers

#### Terminal 1 - Backend
```powershell
cd Backend
npm start
```

✅ Success looks like:
```
> watchparty-backend@1.0.0 start
> node server.js

Server running on port 3000
```

#### Terminal 2 - Frontend
```powershell
cd Frontend
npm start
```

✅ Success looks like:
```
** Angular Live Development Server is listening on localhost:4200 **
✔ Compiled successfully.
```

**Alternative**: Just double-click `start-all.bat` in Windows!

---

### Phase 3: Basic Functionality Test

#### Test 1: Creating a Room

1. **Open browser** → http://localhost:4200
2. **Verify**: Purple gradient background appears
3. **Verify**: "WatchTogether" title visible
4. **Action**: Type "TestUser1" in username field
5. **Action**: Click "✨ Crear Sala Nueva"
6. **Verify**: URL changes to `/room/XXXXXX` (6-char code)
7. **Verify**: Room code appears in header
8. **Verify**: Participant list shows "TestUser1" with "Anfitrión" badge

**Backend Terminal Check**:
```
New client connected: socketId123
Room created: ABC123
```

✅ **PASS**: Room created successfully

---

#### Test 2: Joining a Room

1. **Copy the room code** from header (e.g., "ABC123")
2. **Open new browser tab/window** → http://localhost:4200
3. **Action**: Type "TestUser2" in username field
4. **Action**: Click "Unirse a Sala"
5. **Verify**: Modal dialog opens
6. **Action**: Type room code "ABC123"
7. **Action**: Click "Unirse"
8. **Verify**: Redirects to `/room/ABC123`
9. **Switch to first tab**
10. **Verify**: Participant list now shows both users

**Backend Terminal Check**:
```
User TestUser2 joined room: ABC123
```

✅ **PASS**: Room joining works

---

#### Test 3: Video Synchronization

**Using Sample Video URL**:
```
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
```

**In First Browser (Host)**:
1. **Action**: Click "Cambiar Video / URL"
2. **Verify**: Input field appears
3. **Action**: Paste sample video URL
4. **Action**: Click "Cargar Video"
5. **Verify**: Video loads in player

**In Second Browser**:
6. **Verify**: Video automatically loads (no manual action needed)
7. **Verify**: Same video appears

**Synchronization Test**:
8. **In First Browser**: Click Play ▶
9. **In Second Browser**: Verify video starts playing automatically
10. **In Second Browser**: Click Pause ⏸
11. **In First Browser**: Verify video pauses automatically
12. **In First Browser**: Drag timeline to 1:00
13. **In Second Browser**: Verify video jumps to 1:00

**Backend Terminal Check**:
```
Video changed in room ABC123: [url]
Video playing in room ABC123 at 0s
Video paused in room ABC123 at 15s
Video seeked in room ABC123 to 60s
```

✅ **PASS**: Video sync working perfectly

---

### Phase 4: Advanced Tests

#### Test 4: Third Participant

1. **Open third browser/tab** → http://localhost:4200
2. **Join same room** with code "ABC123" as "TestUser3"
3. **Verify**: All three participants visible
4. **Verify**: Video state matches (playing/paused, same time)
5. **Any user controls video**
6. **Verify**: All three users see changes

✅ **PASS**: Multiple participants supported

---

#### Test 5: Host Transfer

1. **Close or navigate away** in first browser (host)
2. **In remaining browsers**:
   - **Verify**: Participant list updates (TestUser1 removed)
   - **Verify**: New "Anfitrión" badge appears on TestUser2
   - **Verify**: Video still works

**Backend Terminal Check**:
```
Client disconnected: socketId123
Room ABC123: Participant removed
New host assigned: socketId456
```

✅ **PASS**: Host transfer working

---

#### Test 6: Empty Room Cleanup

1. **Close all browsers** with room ABC123 open
2. **Wait 5 seconds**
3. **Try to join** room ABC123 again
4. **Verify**: Error message "Sala no encontrada"

**Backend Terminal Check**:
```
Room ABC123 deleted (empty)
```

✅ **PASS**: Room cleanup working

---

#### Test 7: Multiple Rooms

1. **Browser 1**: Create room → Gets code "ROOM1"
2. **Browser 2**: Create room → Gets code "ROOM2"
3. **Browser 3**: Join "ROOM1"
4. **Browser 4**: Join "ROOM2"
5. **Load different videos** in each room
6. **Verify**: Each room operates independently

✅ **PASS**: Multiple rooms supported

---

#### Test 8: Copy Room Code

1. **In any room**: Click 📋 icon next to room code
2. **Paste in text editor**: Ctrl+V
3. **Verify**: Correct room code pasted

✅ **PASS**: Copy functionality working

---

#### Test 9: Invalid Room Code

1. **Home page**: Click "Unirse a Sala"
2. **Enter**: "FAKE123"
3. **Click**: Unirse
4. **Verify**: Error message "Sala no encontrada" appears
5. **Verify**: Stays on home page

✅ **PASS**: Error handling working

---

#### Test 10: Mobile Responsive

1. **Open DevTools** (F12)
2. **Click**: Device toolbar icon (mobile view)
3. **Select**: iPhone or Android device
4. **Verify**: Layout adjusts properly
5. **Test**: All buttons clickable
6. **Test**: Video player responsive

✅ **PASS**: Mobile responsive

---

## 🎬 Video URLs for Testing

### Sample Videos (Work Great)
```
# Big Buck Bunny (596 MB, 9:56)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4

# Elephant's Dream (82 MB, 10:53)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4

# For Bigger Blazes (4.2 MB, 0:15)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4

# Sintel (124 MB, 14:48)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4
```

### Test Different Formats
```
# MP4 Format
https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4

# WebM Format
https://www.sample-videos.com/video123/webm/720/big_buck_bunny_720p_1mb.webm
```

---

## 📊 Test Results Checklist

```
[ ] Backend starts without errors
[ ] Frontend compiles successfully
[ ] Home page loads with correct styling
[ ] Room creation generates unique code
[ ] Room joining with valid code works
[ ] Room joining with invalid code shows error
[ ] Video URL input accepts text
[ ] Video loads from URL
[ ] Play button syncs across clients
[ ] Pause button syncs across clients
[ ] Seek/scrub syncs across clients
[ ] New participants see current state
[ ] Participant list updates in real-time
[ ] Host badge shows correctly
[ ] Host transfer on disconnect works
[ ] Room deletion when empty works
[ ] Multiple rooms work independently
[ ] Copy room code works
[ ] Exit room works
[ ] Responsive design on mobile works
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot connect to server"
**Symptoms**: Video won't load, participants don't update
**Solution**: 
- Check backend is running on port 3000
- Check browser console for errors
- Verify no firewall blocking

### Issue 2: "Video won't load"
**Symptoms**: Black screen, no playback
**Solution**:
- Use one of the sample URLs above
- Ensure URL is direct video file (.mp4, .webm)
- Check video URL allows CORS
- Try different browser

### Issue 3: "Port already in use"
**Symptoms**: Backend fails to start
**Solution**:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Issue 4: "npm install fails"
**Symptoms**: Missing dependencies errors
**Solution**:
```powershell
# Clear cache
npm cache clean --force

# Delete node_modules
rmdir /s node_modules

# Reinstall
npm install
```

### Issue 5: "Video out of sync"
**Symptoms**: Videos playing at different times
**Solution**:
- Reload all browsers
- Check network latency
- Ensure WebSocket connected (check console)

---

## 📈 Performance Testing

### Load Test
1. Open 5+ browser tabs
2. All join same room
3. Load video
4. Test playback controls
5. Monitor backend CPU/memory

**Expected**: Should handle 10+ concurrent users smoothly

### Network Test
1. Open DevTools → Network tab
2. Throttle to "Fast 3G"
3. Test video sync
4. Check WebSocket messages

**Expected**: May have slight delay but should still sync

---

## 🎯 Demo Script

### 5-Minute Demo

**Minute 1**: Setup
- Show home page
- Explain "Watch videos together in real-time"

**Minute 2**: Create Room
- Click "Crear Sala Nueva"
- Show room code
- Explain sharing with friends

**Minute 3**: Add Participant
- Open new tab/window
- Join with room code
- Show real-time participant update

**Minute 4**: Video Sync Demo
- Load sample video
- Show play/pause sync
- Demonstrate seek sync

**Minute 5**: Features Tour
- Copy room code
- Show participant list
- Demonstrate exit
- Show mobile responsive

---

## 📸 Screenshot Checklist

For documentation/portfolio:
- [ ] Home page (desktop)
- [ ] Home page (mobile)
- [ ] Room with video playing
- [ ] Participant list with multiple users
- [ ] Video source change UI
- [ ] Modal dialog for joining
- [ ] Host badge display
- [ ] Copy room code action
- [ ] Multiple browser windows syncing

---

## ✨ Advanced Demo Ideas

1. **Gaming Stream Watch**: Load a Twitch clip, watch together
2. **Movie Night**: Load movie trailer, synchronized viewing
3. **Study Session**: Watch educational video together
4. **Remote Meeting**: Share recorded meeting playback
5. **Virtual Cinema**: Create "theater" experience

---

## 🎓 Learning Points to Highlight

When demonstrating:
- ✅ Real-time WebSocket communication
- ✅ State synchronization across clients
- ✅ Angular standalone components (modern)
- ✅ Responsive design principles
- ✅ Room-based architecture
- ✅ Event-driven programming
- ✅ Error handling
- ✅ User experience design

---

Happy Testing! 🎉
