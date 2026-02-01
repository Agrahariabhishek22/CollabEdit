import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
// Import configs
import { config } from "./src/config/env.js";
import { connectDatabase } from "./src/config/database.js";
import { connectRedis } from "./src/config/redis.js";
import { initSocketIO } from "./src/config/socketio.js";
// Import middlewares
import { requestLogger } from "./src/middlewares/logging.js";
import { errorHandler, asyncHandler } from "./src/middlewares/errorHandler.js";
import { apiLimiter } from "./src/middlewares/rateLimiter.js";
// Import routes
import authRoutes from "./src/routes/auth.js";
import projectRoutes from "./src/routes/projects.js";
import fileRoutes from "./src/routes/files.js";
import gitRoutes from "./src/routes/git.js";
import inviteRoutes from "./src/routes/inviteRoute.js";
// Import Socket.io handlers
import {
  socketAuth,
  handleConnection,
  handleDisconnection,
  handleHeartbeat,
  handleJoinProject,
  handleLeaveProject,
  handleError,
} from "./src/socket/handlers/connectionHandler.js";

const app = express();
const server = http.createServer(app);

// ============ MIDDLEWARE STACK ============
// Trust proxy
app.set("trust proxy", 1);

// CORS
app.use(
  cors({
    origin: config.CORS_ORIGIN.split(","),
    credentials: true,
  }),
);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ limit: "10kb", extended: true }));

// Cookie Parser
app.use(cookieParser());

// Request Logging
// app.use(requestLogger);

// Rate Limiting (API-wide)
app.use("/api/", apiLimiter);

// ============ HEALTH CHECK ============
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

// ============ API ROUTES ============
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/git", gitRoutes);
app.use("/api/invitations",inviteRoutes);

// ============ 404 HANDLER ============
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.path} not found`,
  });
});

// ============ ERROR HANDLER (Must be last) ============
app.use(errorHandler);

// ============ SOCKET.IO SETUP ============
let io = null;

const initializeSocketIO = async () => {
  try {
    io = initSocketIO(server);

    // Socket.io Authentication Middleware
    io.use(socketAuth);

    // Connection Handlers
    io.on("connection", (socket) => {
      // Initial connection
      handleConnection(socket);

      // Heartbeat - keep session alive
      socket.on("heartbeat", (data) => handleHeartbeat(socket, data));

      // Project Room Management
      socket.on("join-project", (data) => handleJoinProject(socket, data));
      socket.on("leave-project", (data) => handleLeaveProject(socket, data));

      // Error handling
      socket.on("error", (error) => handleError(socket, error));

      // Disconnection
      socket.on("disconnect", () => handleDisconnection(socket));
    });

    console.log("✓ Socket.io handlers registered");
  } catch (error) {
    console.error("Failed to initialize Socket.io:", error);
    throw error;
  }
};

// ============ SERVER STARTUP ============
const startServer = async () => {
  try {
    console.log("\nStarting CollabEdit Backend Server...\n");
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    // Initialize Socket.io
    await initializeSocketIO();

    // Start server
    server.listen(config.PORT, config.HOST, () => {
      console.log(`✓ Server running on http://${config.HOST}:${config.PORT}`);
      console.log(`✓ Environment: ${config.NODE_ENV}`);
      console.log(`✓ WebSocket ready on ws://${config.HOST}:${config.PORT}`);
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    });
  } catch (error) {
    console.error(" Server startup failed:", error.message);
    process.exit(1);
  }
};

// ============ GRACEFUL SHUTDOWN ============
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

// Start the server
startServer();
