/**
 * Invitation Routes
 * Multi-level permissions: project/folder/file (local) + project/branch (git)
 */

import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  sendInvitations,
  respondToInvitation,
  userSelfRevoke,
  getCollaborators,
} from "../controllers/invitationController.js";

const router = express.Router();

// ===== Send Invitations (Admin) =====
router.post("/:resourceId/invite", authenticate, sendInvitations);

// ===== Respond to Invitation (User) =====
router.post("/respond/:notifId", authenticate, respondToInvitation);

// ===== Self Revoke (User) =====
router.post("/revoke/:fileMetaId", authenticate, userSelfRevoke);

// ===== Get Collaborators for Modal (Admin) =====
router.get("/:resourceId/collaborators", authenticate, getCollaborators);

export default router;