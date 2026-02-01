# 🎯 Day 2 Implementation Complete - Testing Guide

## ✅ What's Been Implemented

### **1. Express Server Infrastructure**
- ✓ Full middleware stack (CORS, body parser, cookie parser, logging)
- ✓ Error handling (centralized error handler, async wrapper)
- ✓ Request logging middleware
- ✓ Rate limiting (API-wide & per-endpoint)
- ✓ Health check endpoints

### **2. Authentication System**
- ✓ JWT token generation & verification
- ✓ Password hashing with bcrypt
- ✓ Signup route with validation
- ✓ Login route with email/password verification
- ✓ Logout route with token blacklisting
- ✓ Get current user endpoint
- ✓ Token verification endpoint

### **3. Session Management**
- ✓ Redis session storage (30min TTL)
- ✓ Session creation on login
- ✓ Session deletion on logout
- ✓ Token blacklist for logout security
- ✓ Session validation in auth middleware

### **4. Socket.io WebSocket Setup**
- ✓ Socket.io with Redis Adapter (for horizontal scaling)
- ✓ Socket.io authentication middleware
- ✓ Room-based architecture (`project:{projectId}`)
- ✓ User-specific rooms (`user:{userId}`)

### **5. Connection Management**
- ✓ Connection handler with welcome message
- ✓ Disconnection handler with logging
- ✓ 60-second heartbeat mechanism for keep-alive
- ✓ Join project room functionality
- ✓ Leave project room functionality
- ✓ User presence notifications

### **6. Database Configuration**
- ✓ Prisma client initialization
- ✓ PostgreSQL connection
- ✓ Connection error handling
- ✓ Connection pool setup

### **7. Redis Configuration**
- ✓ Redis client connection
- ✓ Redis subscriber for pub/sub
- ✓ Session management functions
- ✓ Token blacklist functions
- ✓ Chat history rolling buffer
- ✓ Heartbeat tracking

### **8. API Routes (Skeleton)**
- ✓ `/api/auth/*` - Authentication routes (COMPLETE)
- ✓ `/api/projects` - Projects routes (STUB, ready for Day 3-5)
- ✓ `/api/files` - Files routes (STUB, ready for Day 5)
- ✓ `/api/git` - Git routes (STUB, ready for Day 5)

### **9. Documentation**
- ✓ API_DOCUMENTATION.md with full examples
- ✓ .env.example with all required variables
- ✓ Inline code comments
- ✓ This testing guide

---

## 🧪 How to Test

### **Prerequisites**
Ensure Docker is running and containers are healthy:
```bash
cd c:\Users\abhis\Desktop\CollabEdit

# Start containers
docker-compose up -d --build

# Check status
docker-compose ps
```

Expected output:
```
NAME                    STATUS
collaborative_postgres up
collaborative_redis     up
collaborative_backend   up
collaborative_frontend  up
```

---

### **Test 1: Server Health Check**

**Endpoint**: `GET http://localhost:3000/`

**Using Browser**: 
```
Open: http://localhost:3000
```

**Using Curl**:
```bash
curl http://localhost:3000
```

**Expected Response**:
```json
{
  "success": true,
  "message": "CollabEdit Backend is running",
  "timestamp": "2026-02-01T...",
  "environment": "development"
}
```

---

### **Test 2: Database Connection**

**Check Backend Logs**:
```bash
docker logs collaborative_backend
```

**Look For**:
```
✓ Database connected successfully
✓ Redis Client Connected
✓ Redis Subscriber Connected
✓ Socket.io initialized with Redis Adapter
✓ Server running on http://0.0.0.0:3000
```

---

### **Test 3: Signup**

**Endpoint**: `POST http://localhost:3000/api/auth/signup`

**Using Curl**:
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123456",
    "confirmPassword": "Test123456"
  }'
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid-here",
      "name": "Test User",
      "email": "test@example.com",
      "createdAt": "2026-02-01T..."
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Check DB**:
```bash
docker exec -it collaborative_postgres psql -U abhishek -d collab_editor_db -c "SELECT * FROM \"User\";"
```

---

### **Test 4: Login**

**Endpoint**: `POST http://localhost:3000/api/auth/login`

**Using Curl** (with cookie):
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "name": "Test User",
      "email": "test@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Check Redis Session**:
```bash
docker exec -it collaborative_redis redis-cli
> KEYS session:*
> GET session:{userId}
> exit
```

---

### **Test 5: Get Current User**

**Endpoint**: `GET http://localhost:3000/api/auth/me`

**Using Curl** (with saved cookie):
```bash
curl http://localhost:3000/api/auth/me -b cookies.txt
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "name": "Test User",
      "email": "test@example.com",
      "createdAt": "2026-02-01T..."
    }
  }
}
```

---

### **Test 6: Verify Token**

**Endpoint**: `GET http://localhost:3000/api/auth/verify`

**Using Curl**:
```bash
curl http://localhost:3000/api/auth/verify -b cookies.txt
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "id": "uuid-here"
    }
  }
}
```

---

### **Test 7: Logout**

**Endpoint**: `POST http://localhost:3000/api/auth/logout`

**Using Curl**:
```bash
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Check Redis Blacklist**:
```bash
docker exec -it collaborative_redis redis-cli
> KEYS blacklist:*
> exit
```

---

### **Test 8: WebSocket Connection**

**Using Node.js Client** (in another terminal):

Create file `test-socket.js`:
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-from-login'
  }
});

socket.on('connection-established', (data) => {
  console.log('✓ Connected:', data);
  
  // Test heartbeat
  setInterval(() => {
    socket.emit('heartbeat', { projectId: 'project-123' });
  }, 60000);
  
  // Test join room
  socket.emit('join-project', { projectId: 'project-123' });
  
  socket.on('room-joined', (data) => {
    console.log('✓ Joined room:', data);
  });
});

socket.on('disconnect', () => {
  console.log('✗ Disconnected');
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});
```

Run it:
```bash
node test-socket.js
```

**Expected Output**:
```
✓ Connected: { message: 'Connected to server', userId: '...', ... }
✓ Joined room: { roomName: 'project:project-123', ... }
```

---

### **Test 9: Rate Limiting**

**Test Login Limit** (5 attempts per 15 min):
```bash
# Try login 6 times quickly
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "wrong"
    }'
  echo "\n"
done
```

**Expected Response** (429 Too Many Requests on 6th attempt):
```json
{
  "success": false,
  "message": "Too many login attempts. Please try again later."
}
```

---

### **Test 10: Error Cases**

**Missing Email**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "Test123456"}'
```

**Expected** (400 Bad Request):
```json
{
  "success": false,
  "message": "Please provide email and password"
}
```

**Wrong Password**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "WrongPassword"
  }'
```

**Expected** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Invalid password"
}
```

**Protected Route Without Token**:
```bash
curl http://localhost:3000/api/auth/me
```

**Expected** (401 Unauthorized):
```json
{
  "success": false,
  "message": "Not authenticated. Please login first"
}
```

---

## 📊 Testing Checklist

- [ ] Server starts without errors
- [ ] All containers healthy (docker-compose ps)
- [ ] Health check returns 200
- [ ] Signup creates user in PostgreSQL
- [ ] Login returns JWT token
- [ ] JWT token stored in Redis as session
- [ ] Get /auth/me returns current user
- [ ] Logout removes session and blacklists token
- [ ] Can't access protected route without token
- [ ] WebSocket connects with valid token
- [ ] Heartbeat keeps-alive every 60s
- [ ] Can join/leave project rooms
- [ ] Rate limiting blocks after limit exceeded
- [ ] Invalid requests return proper error codes
- [ ] Logs show all activities

---

## 📝 Git Commit

After testing, commit your changes:

```bash
cd c:\Users\abhis\Desktop\CollabEdit

# Add all changes
git add -A

# Commit
git commit -m "feat(auth,socket): Day 2 - Express server, JWT auth, Socket.io setup

- Implemented JWT authentication (signup/login/logout)
- Session management with Redis (30min TTL)
- Socket.io with Redis Adapter for horizontal scaling
- Heartbeat mechanism (60s keep-alive)
- Room-based project architecture
- Rate limiting and error handling
- Full API documentation
- All authentication routes complete

Ready for Day 3: CRDT sync implementation"

# Push to develop
git push origin feature/express-socket -u

# Create PR for code review
# Merge to develop after review
```

---

## 🚀 Next Steps (Day 3)

Now that the foundation is solid:
1. **Day 3-4**: Implement Yjs CRDT synchronization
2. Test real-time text sync between multiple clients
3. Implement cursor presence
4. Verify < 500ms latency

---

## 📞 Troubleshooting

### Containers won't start
```bash
docker-compose logs -f
```

### Redis connection error
```bash
docker exec -it collaborative_redis redis-cli ping
# Should return: PONG
```

### Database migration failed
```bash
docker exec -it collaborative_backend npx prisma migrate dev
```

### Port already in use
```bash
# Change port in docker-compose.yml or kill process
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # macOS/Linux
```

---

**Congratulations! Day 2 is complete. All auth, session, and socket infrastructure is ready.** ✅
