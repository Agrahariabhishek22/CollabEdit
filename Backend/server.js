// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";

// ════════════════════════════════════════════════════════════
// IMPORT CONFIGS (Using your existing structure)
// ════════════════════════════════════════════════════════════
import { config } from "./src/config/env.js";
import { connectDatabase, prisma, disconnectDatabase } from "./src/config/database.js";
import { connectRedis, getRedisClient, getRedisPubSub, disconnectRedis } from "./src/config/redis.js";
import { initSocketIO } from "./src/config/socketio.js";

// ════════════════════════════════════════════════════════════
// IMPORT MIDDLEWARES
// ════════════════════════════════════════════════════════════
import { requestLogger } from "./src/middlewares/logging.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import { apiLimiter } from "./src/middlewares/rateLimiter.js";

// ════════════════════════════════════════════════════════════
// IMPORT ROUTES (Your existing routes)
// ════════════════════════════════════════════════════════════
import authRoutes from "./src/routes/auth.js";
import projectRoutes from "./src/routes/projects.js";
import fileRoutes from "./src/routes/files.js";
import gitRoutes from "./src/routes/git.js";
import inviteRoutes from "./src/routes/inviteRoute.js";
import explorerRoutes from "./src/routes/explorerRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";

// ════════════════════════════════════════════════════════════
// IMPORT SERVICES (New - for editor collaboration)
// ════════════════════════════════════════════════════════════
import SessionManager from "./src/services/session/SessionManager.js";
import FileSessionTracker from "./src/services/session/FileSessionTracker.js";
import YjsDocManager from "./src/services/yjs/YjsDocManager.js";
import YjsPersistence from "./src/services/yjs/YjsPersistence.js";
import LSPManager from "./src/services/lsp/LSPManager.js";
import PermissionValidator from "./src/services/permissions/PermissionValidator.js";
import RoleChangeHandler from "./src/services/permissions/RoleChangeHandler.js";
// import CheckpointManager from "./src/services/checkpoint/CheckpointManager.js";
// import VotingManager from "./src/services/checkpoint/VotingManager.js";

// ════════════════════════════════════════════════════════════
// IMPORT SOCKET HANDLERS
// ════════════════════════════════════════════════════════════

// Existing handlers (Your current logic)
import {
  socketAuth,
  handleConnection as handleBasicConnection,
  handleDisconnection as handleBasicDisconnection,
  handleHeartbeat,
  handleJoinProject,
  handleLeaveProject,
  handleError,
} from "./src/socket/handlers/connectionHandler.js";

// New handlers (Editor collaboration)
import YjsHandler from "./src/socket/handlers/yjs.Handler.js";
import LSPHandler from "./src/socket/handlers/lsp.handler.js";
import PermissionHandler from "./src/socket/handlers/permission.handler.js";
import CheckpointHandler from "./src/socket/handlers/checkpoint.handler.js";
import FileConnectionHandler from "./src/socket/handlers/fileConnection.handler.js";

// ════════════════════════════════════════════════════════════
// IMPORT BACKGROUND JOBS (New - automated tasks)
// ════════════════════════════════════════════════════════════
import FlushScheduler from "./src/jobs/FlushScheduler.js";
import SessionCleanup from "./src/jobs/SessionCleanup.js";
import LSPHealthCheck from "./src/jobs/LSPHealthCheck.js";

// ════════════════════════════════════════════════════════════
// APP & SERVER SETUP
// ════════════════════════════════════════════════════════════
const app = express();
const server = http.createServer(app);

// ════════════════════════════════════════════════════════════
// MIDDLEWARE STACK (Your existing setup - INTACT)
// ════════════════════════════════════════════════════════════
// app.set("trust proxy", 1);

app.use(
  cors({
    origin: config.CORS_ORIGIN.split(","),
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ limit: "10kb", extended: true }));
app.use(cookieParser());

// app.use(requestLogger);
// app.use("/api/", apiLimiter);

// ════════════════════════════════════════════════════════════
// HEALTH CHECK (Your existing endpoints - INTACT)
// ════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CollabEdit Backend is running",
    timestamp: new Date(),
    environment: config.NODE_ENV,
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// ════════════════════════════════════════════════════════════
// API ROUTES (Your existing routes - INTACT)
// ════════════════════════════════════════════════════════════
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/git", gitRoutes);
app.use("/api/invitations", inviteRoutes);
app.use("/api/explorer", explorerRoutes);
app.use("/api/notifications", notificationRoutes);

// ════════════════════════════════════════════════════════════
// 404 HANDLER
// ════════════════════════════════════════════════════════════
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.path} not found`,
  });
});

// ════════════════════════════════════════════════════════════
// ERROR HANDLER (Must be last)
// ════════════════════════════════════════════════════════════
app.use(errorHandler);

// ════════════════════════════════════════════════════════════
// GLOBAL VARIABLES (Service instances)
// 
// NOTE: These are initialized in initializeServices()
// Made global so handlers can access them
// ════════════════════════════════════════════════════════════
let io = null;
let redis = null;
let redisPubSub = null;

// Service instances
let sessionManager = null;
let fileSessionTracker = null;
let yjsDocManager = null;
let lspManager = null;
let permissionValidator = null;
let roleChangeHandler = null;
// let checkpointManager = null;
// let votingManager = null;

// Socket handlers
let yjsHandler = null;
let lspHandler = null;
let permissionHandler = null;
let checkpointHandler = null;
let fileConnectionHandler = null;

// Background jobs
let flushScheduler = null;
let sessionCleanup = null;
let lspHealthCheck = null;

// ════════════════════════════════════════════════════════════
// SERVICE INITIALIZATION
// 
// PURPOSE: Initialize all services with proper dependencies
// CALLED: After database & Redis connection established
// ════════════════════════════════════════════════════════════
const initializeServices = async () => {
  try {
    console.log("\n[Services] Initializing core services...");

    // Get Redis clients (using your existing config)
    redis = getRedisClient();
    redisPubSub = getRedisPubSub();

    // SessionManager: Tracks users, tabs, file sessions
    sessionManager = new SessionManager(redis, io);
    
    // FileSessionTracker: Who's editing which file
    fileSessionTracker = new FileSessionTracker(redis, sessionManager);
    
    // YjsPersistence: Handles disk read/write for Yjs
    const yjsPersistence = new YjsPersistence(prisma);
    
    // YjsDocManager: Manages Shadow Y.Docs in RAM
    yjsDocManager = new YjsDocManager(redis, yjsPersistence);
    
    // LSPManager: Spawns & manages language server processes
    lspManager = new LSPManager(redis);
    
    // PermissionValidator: Real-time RBAC checks
    permissionValidator = new PermissionValidator(
      prisma,
      redis,
      sessionManager,
      io
    );
    
    // RoleChangeHandler: Live role updates & revocation
    roleChangeHandler = new RoleChangeHandler(
      prisma,
      redis,
      sessionManager,
      io
    );
    
    // CheckpointManager: Create/load checkpoints
    // checkpointManager = new CheckpointManager(prisma, yjsDocManager);
    
    // VotingManager: Democratic revert system
    // votingManager = new VotingManager(redis);

    // Make services globally available
    global.sessionManager = sessionManager;
    global.prisma = prisma;

    console.log("✓ Core services initialized");
  } catch (error) {
    console.error("✗ Service initialization failed:", error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════
// SOCKET.IO SETUP
// 
// PURPOSE: Initialize Socket.io with all handlers
// COMBINES: Your existing logic + new editor handlers
// ════════════════════════════════════════════════════════════
const initializeSocketIO = async () => {
  try {
    console.log("\n[Socket.io] Initializing...");

    // Initialize Socket.io (using your existing config)
    io = initSocketIO(server);
    // 🔥 FIX: Services mein io inject karo kyunki wo pehle null the
    if (sessionManager) {
      sessionManager.setIo(io);
      console.log("✓ SessionManager synced with Socket.io");
    }
     
    if (permissionValidator) {
      permissionValidator.setIo(io);
      console.log("✓ PermissionValidator synced with Socket.io");
    }

    // Make io globally available
    global.io = io;

    // Socket.io Authentication Middleware (your existing)
    io.use(socketAuth);

    // ════════════════════════════════════════════════════════
    // INITIALIZE SOCKET HANDLERS (New - for editor)
    // ════════════════════════════════════════════════════════
    
    // YjsHandler: Real-time Yjs sync
    yjsHandler = new YjsHandler(
      io,
      yjsDocManager,
      permissionValidator,
      sessionManager,
      redis
    );

    // LSPHandler: Code intelligence (diagnostics, completion)
    lspHandler = new LSPHandler(
      io,
      lspManager,
      yjsDocManager,
      permissionValidator
    );

    // PermissionHandler: Live role changes
    permissionHandler = new PermissionHandler(
      io,
      roleChangeHandler,
      sessionManager,
      redis
    );

    // CheckpointHandler: Voting system
    // checkpointHandler = new CheckpointHandler(
    //   io,
    //   checkpointManager,
    //   votingManager,
    //   permissionValidator
    // );

    // FileConnectionHandler: File join/leave
    fileConnectionHandler = new FileConnectionHandler(
      io,
      sessionManager,
      permissionValidator,
      yjsDocManager,
      lspManager
    );

    // ════════════════════════════════════════════════════════
    // CONNECTION HANDLERS (Combined - existing + new)
    // ════════════════════════════════════════════════════════
    io.on("connection", (socket) => {
      // ════════════════════════════════════════════════════
      // BASIC CONNECTION SETUP (Your existing logic)
      // ════════════════════════════════════════════════════
      handleBasicConnection(socket);

      // ════════════════════════════════════════════════════
      // EXISTING HANDLERS (Your current events - INTACT)
      // ════════════════════════════════════════════════════
      socket.on("heartbeat", (data) => handleHeartbeat(socket, data));
      socket.on("join-project", (data) => handleJoinProject(socket, data));
      socket.on("leave-project", (data) => handleLeaveProject(socket, data));
      socket.on("error", (error) => handleError(socket, error));

      // ════════════════════════════════════════════════════
      // NEW HANDLERS (Editor collaboration features) 
      // These register multiple events:
      // - file:join, file:leave, cursor:update (fileConnectionHandler)
      // - yjs:request-state, yjs:update, yjs:awareness (yjsHandler)
      // - lsp:analyze, lsp:completion, lsp:hover (lspHandler)
      // - permission:change-role, permission:revoke (permissionHandler)
      // - checkpoint:create, checkpoint:request-revert, checkpoint:vote (checkpointHandler)
      // ════════════════════════════════════════════════════
      fileConnectionHandler.register(socket);
      yjsHandler.register(socket);
      lspHandler.register(socket);
      permissionHandler.register(socket);
      // checkpointHandler.register(socket);

      // ════════════════════════════════════════════════════
      // DISCONNECTION (Combined cleanup)
      // ════════════════════════════════════════════════════
      socket.on("disconnect", async () => {
        // Your existing disconnect logic
        handleBasicDisconnection(socket);

        // New disconnect logic (file session cleanup)
        await fileConnectionHandler.handleDisconnect(socket);
      });
    });

    console.log("✓ Socket.io handlers registered");
  } catch (error) {
    console.error("✗ Socket.io initialization failed:", error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════
// REDIS PUB/SUB SETUP (For Yjs horizontal scaling)
// 
// PURPOSE: Broadcast Yjs updates across multiple server instances
// HOW IT WORKS:
// 1. User A types on Server 1
// 2. Server 1 publishes to Redis: yjs:update:{fileId}
// 3. Server 2, 3, ... subscribe and receive update
// 4. Each server broadcasts to its own Socket.io clients
// ════════════════════════════════════════════════════════════
const initializePubSub = async () => {
  try {
    console.log("\n[Redis Pub/Sub] Setting up...");

    // Subscribe to Yjs updates
    await redisPubSub.subscribe("yjs:update:*", (message, channel) => {
      // Extract fileId from channel name
      const fileId = channel.replace("yjs:update:", "");
      const data = JSON.parse(message);

      // Broadcast to all clients on this server EXCEPT sender
      // NOTE: .except() prevents echo back to sender
      io.to(`file:${fileId}`).except(data.socketId).emit("yjs:update", {
        fileId,
        update: data.update,
        userId: data.userId,
        userName: data.userName,
      });
    });

    console.log("✓ Redis Pub/Sub active");
  } catch (error) {
    console.error("✗ Redis Pub/Sub setup failed:", error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════
// BACKGROUND JOBS SETUP
// 
// PURPOSE: Automated maintenance tasks
// JOBS:
// 1. FlushScheduler: Flush Shadow Docs to disk every 5 min
// 2. SessionCleanup: Remove idle sessions every 2 min
// 3. LSPHealthCheck: Kill idle LSP processes every 3 min
// ════════════════════════════════════════════════════════════
const initializeBackgroundJobs = () => {
  try {
    console.log("\n[Background Jobs] Starting...");

    // FlushScheduler: Periodic disk sync (every 5 min)
    // Flushes all active Shadow Y.Docs to disk
    flushScheduler = new FlushScheduler(yjsDocManager);
    flushScheduler.start();

    // SessionCleanup: Idle session cleanup (every 2 min)
    // Removes Shadow Docs with no active users
    sessionCleanup = new SessionCleanup(
      sessionManager,
      fileSessionTracker,
      yjsDocManager
    );
    sessionCleanup.start();

    // LSPHealthCheck: LSP process monitor (every 3 min)
    // Kills idle language server processes
    lspHealthCheck = new LSPHealthCheck(lspManager);
    lspHealthCheck.start();

    console.log("✓ Background jobs started");
  } catch (error) {
    console.error("✗ Background jobs failed:", error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════
// SERVER STARTUP (Main initialization sequence)
// ════════════════════════════════════════════════════════════
const startServer = async () => {
  try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  🚀 Starting CollabEdit Backend Server");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Step 1: Connect to database (using your existing function)
    await connectDatabase();

    // Step 2: Connect to Redis (using your existing function)
    await connectRedis();

    // Step 3: Initialize services (new - for editor collaboration)
    await initializeServices();

    // Step 4: Initialize Socket.io (enhanced with new handlers)
    await initializeSocketIO();

    // Step 5: Setup Redis Pub/Sub (new - for horizontal scaling)
    // await initializePubSub();

    // Step 6: Start background jobs (new - automated tasks)
    // initializeBackgroundJobs();

    // Step 7: Start HTTP server
    server.listen(config.PORT, config.HOST, () => {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  ✓ Server Status: RUNNING");
      console.log(`  ✓ HTTP:      http://${config.HOST}:${config.PORT}`);
      console.log(`  ✓ WebSocket: ws://${config.HOST}:${config.PORT}`);
      console.log(`  ✓ Environment: ${config.NODE_ENV}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });
  } catch (error) {
    console.error("\n✗ Server startup failed:", error.message);
    process.exit(1);
  }
};

// ════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN (Cleanup on exit)
// ════════════════════════════════════════════════════════════
process.on("SIGTERM", async () => {
  console.log("\n[Shutdown] SIGTERM received, shutting down gracefully...");

  try {
    // Stop background jobs
    if (flushScheduler) flushScheduler.stop();
    if (sessionCleanup) sessionCleanup.stop();
    if (lspHealthCheck) lspHealthCheck.stop();

    // Flush all active Shadow Docs
    if (flushScheduler && yjsDocManager) {
      await flushScheduler.flushAll();
    }

    // Close database connection (using your existing function)
    await disconnectDatabase();

    // Close Redis connections (using your existing function)
    await disconnectRedis();

    // Close HTTP server
    server.close(() => {
      console.log("✓ Server closed");
      process.exit(0);
    });
  } catch (error) {
    console.error("✗ Shutdown error:", error);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════════
// START THE SERVER
// ════════════════════════════════════════════════════════════
startServer();