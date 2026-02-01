import express from "express";
import { respondToInvitation, sendInvitations } from "../controllers/invitationController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

// Middleware: 'protect' ensure karega user logged in hai
router.post("/send", protect, sendInvitations);
router.post("/respond", protect, respondToInvitation);
export default router;