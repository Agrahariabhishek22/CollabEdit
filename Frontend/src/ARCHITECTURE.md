## Editor Frontend Architecture

### 📂 Component Structure

```
Frontend/src/
├── pages/
│   ├── EditorPage.jsx               # Main editor page container
│   ├── DashboardLayout.jsx          # Dashboard wrapper
│   ├── login.jsx                    # Login page
│   └── SignUp.jsx                   # Sign up page
│
├── components/
│   ├── Editor/
│   │   ├── EditorHeader/
│   │   │   ├── EditorHeader.jsx          # Main header component (h-16)
│   │   │   ├── CheckpointDropdown.jsx    # Checkpoint management dropdown
│   │   │   ├── ActivityLogButton.jsx     # Activity log modal trigger
│   │   │   ├── SaveButton.jsx            # Save file to disk
│   │   │   ├── LiveCollaborators.jsx     # Real-time collaborator avatars
│   │   │   ├── ChatToggleButton.jsx      # Chat panel toggle
│   │   │   └── index.js
│   │   │
│   │   ├── EditorCore/                   # [TODO] 5-layer editor engine
│   │   └── index.js
│   │
│   ├── ChatPanel.jsx                # Real-time chat (Redis-backed)
│   ├── ContextMenu.jsx              # Context menu component
│   ├── Sidebar.jsx                  # File explorer sidebar
│   ├── HeaderStrip.jsx              # Top navigation strip
│   └── ...
│
├── modals/
│   ├── ActivityLogModal.jsx         # Recent 100 operations view
│   ├── CheckpointPreviewModal.jsx   # Preview checkpoint with diff
│   ├── VotingModal.jsx              # Democratic revert voting
│   └── index.js
│
├── hooks/
│   └── useSocket.js                 # Socket.io hook for components
│
├── context/
│   └── SocketContext.jsx            # Centralized Socket provider
│
├── App.jsx                          # Main app with SocketProvider
├── main.jsx                         # Entry point
└── index.css                        # Tailwind styles
```

### 🔌 Socket Events Reference

#### Collaborators (LiveCollaborators.jsx)
- `collaborator:joined` - New user joins session
- `collaborator:left` - User leaves session
- `collaborators:list` - Get current collaborators
- `collaborators:get` - Request collaborators list

#### Checkpoints (CheckpointDropdown.jsx, CheckpointPreviewModal.jsx)
- `checkpoint:preview` - Preview specific checkpoint
- `checkpoint:revert-request` - Request revert to checkpoint
- `checkpoints:get` - Fetch all checkpoints for file

#### Chat (ChatPanel.jsx)
- `chat:history` - Get chat history (last 50)
- `chat:send-message` - Send message
- `chat:message-received` - Receive message
- `chat:typing` - Typing indicator
- `chat:get-history` - Request chat history

#### Voting (VotingModal.jsx)
- `voting:vote` - Submit vote (yes/no)
- `voting:update` - Vote count update

#### Files (SaveButton.jsx)
- `file:saved` - Notify after save

### 🎯 API Endpoints (Placeholder - Replace with actual)

```javascript
// Files
GET    /api/files/:fileId/content          # Get file content
POST   /api/files/:fileId/save             # Save file to disk
GET    /api/files/:fileId/checkpoints      # Get all checkpoints
DELETE /api/files/:fileId/checkpoints/:cpId # Delete checkpoint
GET    /api/files/:fileId/activity-log     # Get activity log (limit 100)
```

### 🔄 Data Flow Diagrams

#### User Types a Character
```
User types → InputLayer (contentEditable) → calculateDelta 
→ Yjs.applyDelta() → DisplayLayer updates → WebSocket 
→ Backend (Redis Pub/Sub) → Other clients → Their Yjs instances update 
→ Their DisplayLayer updates (Cursors visible in real-time)
```

#### Save Button Click
```
User clicks Save → SaveButton sends file content to API 
→ Backend saves to disk → Returns success 
→ Socket.emit('file:saved') → All collaborators notified 
→ Activity log appended (debounced after 800ms)
```

#### Checkpoint Preview
```
User clicks checkpoint → CheckpointDropdown emits 'checkpoint:preview' 
→ Backend retrieves checkpoint binary → Sends to client 
→ CheckpointPreviewModal opens → Content rendered in read-only editor 
→ User clicks Revert → CheckpointPreviewModal emits 'checkpoint:revert-request' 
→ VotingModal opens with collaborators → Voting happens 
→ Majority vote → Backend reverts main Yjs doc
```

#### Chat Message Flow
```
User types message → ChatPanel captures input 
→ Emit 'chat:send-message' with message payload 
→ Backend appends to Redis LIST (RPUSH) and trims (LTRIM, keep last 50) 
→ Backend broadcasts 'chat:message-received' to all in room 
→ All clients receive and append to their messages array 
→ UI updates with new message
```

### 🚀 Integration Points

#### 1. SocketProvider (App.jsx)
Wraps entire app to provide socket context to all components.

```javascript
<SocketProvider>
  <Router>
    <Routes>...</Routes>
  </Router>
</SocketProvider>
```

#### 2. useSocket Hook
Used in any component to access socket and connection status.

```javascript
const { socket, isConnected } = useSocket();
socket?.emit('event-name', data);
socket?.on('event-name', handler);
```

#### 3. EditorHeader Integration (EditorPage.jsx)
Main header bar with all tools:

```javascript
<EditorHeader
  selectedFile={selectedFile}
  editorContent={editorContent}
  onChatToggle={handleChatToggle}
  isChatOpen={isChatOpen}
/>
```

### ⚙️ Configuration

#### Socket Client Config (SocketContext.jsx)
```javascript
io(socketUrl, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  auth: { token: localStorage.getItem("token") }
})
```

#### Environment Variables
```
REACT_APP_SOCKET_URL=http://localhost:5000  # Backend socket server
```

### 📝 Next Steps

1. **EditorCore Implementation**
   - Create 5-layer editor engine (Display, Input, Overlay, Widget, Scroll)
   - Integrate Monaco Editor or custom textarea with syntax highlighting
   - Implement Yjs bindings for real-time sync
   - Add Tree-sitter WASM for syntax highlighting

2. **LSP Integration**
   - Connect to backend LSP servers
   - Implement semantic diagnostics
   - Add autocomplete suggestions
   - Show hover tooltips

3. **Git Integration**
   - Display branch info in header
   - Show commit history
   - Implement diff viewer

4. **Testing**
   - Unit tests for components
   - Integration tests for socket events
   - E2E tests for collaborative editing

### 🔐 Security Notes

- JWT tokens stored in localStorage (consider secure HttpOnly cookies)
- Socket auth middleware on backend validates user permissions
- File access controlled by projectId + role-based ACL
- Rate limiting on file save API

### 🎨 Styling

Uses Tailwind CSS with dark theme (slate-950 background).
All components follow consistent color palette:
- Primary buttons: blue-600
- Success: green-400
- Error: red-400
- Warning: amber-600
- Backgrounds: slate-950, slate-900, slate-800
