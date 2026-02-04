import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser" 
import connectDB from "./src/config/db.js";
import connectRedis from "./src/config/redis.js";
import authRoutes from "./src/routes/authRoutes.js"
import creationRoutes from "./src/routes/capsuleCreationRoutes.js"
import {authMiddleware} from "./src/middlewares/authMiddleware.js"
import cronService from "./src/services/nodecronServices.js";
import { initDeliveryWorker } from "./src/workers/deliveryWorker.js";
import { initReminderWorker } from "./src/workers/reminderWorker.js";
import { unlockWebhookCapsule } from "./src/controllers/webhookCapsuleController.js";
import { unlockLocationCapsule } from "./src/controllers/locationCapsuleController.js";
import { callbackGitub, disconnectGithub, gitChecker } from "./src/controllers/gitHubController.js";
import { downloadCapsuleFile } from "./src/controllers/capsuleRetrievalController.js";
import sessionRoutes from "./src/routes/sessionRoutes.js"
import {  validateDecryptionSession } from "./src/middlewares/sessionMiddleware.js";

const PORT = process.env.PORT || 3000;

const app = express();
// middlewares 
app.use(cors({
  origin:true,
  credentials: true
}));
// it parses json data sent by client into js object and put it in req.body
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running ",
  });
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/capsules",creationRoutes)
app.get("/api/webhook/trigger/:webhookId",unlockWebhookCapsule)
app.post("/api/unlock/location",authMiddleware,unlockLocationCapsule)
app.get("/api/auth/github/callback",authMiddleware,callbackGitub)
app.get("/api/auth/gitstatus",authMiddleware,gitChecker);
app.get('/api/capsules/:capsuleId/files/:contentIndex',authMiddleware,validateDecryptionSession,downloadCapsuleFile)
app.use("/api/session",sessionRoutes);
app.post("/api/auth/github/disconnect",authMiddleware,disconnectGithub)

const HOST = '0.0.0.0';
const startServer = async () => {
  try {
    await connectRedis();
    await connectDB();   
    app.listen(PORT,HOST,() => {
      console.log(`Server running on port ${PORT}`);
    });
    cronService();     
    initDeliveryWorker();
    initReminderWorker();

  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  } 
};

startServer();
