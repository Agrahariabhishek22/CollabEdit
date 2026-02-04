/**
 * Invitation Routes
 * Multi-level permissions: project/folder/file (local) + project/branch (git)
 */

import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  sendInvitations,
  respondToInvitation,
  userSelfRevoke,
  getCollaborators,
} from "../controllers/invitationController.js";

const router = express.Router();

// ===== Send Invitations (Admin) =====
router.post("/:resourceId/invite", protect, sendInvitations);

// ===== Respond to Invitation (User) =====
router.post("/respond/:notifId", protect, respondToInvitation);

// ===== Self Revoke (User) =====
router.post("/revoke/:fileMetaId", protect, userSelfRevoke);

// ===== Get Collaborators for Modal (Admin) =====
router.get("/:resourceId/collaborators", protect, getCollaborators);

export default router;