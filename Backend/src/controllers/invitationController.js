/**
 * Invitation Controller: Complete Multi-Level Flow
 * Handles project/folder/file (local) and project/branch (git) invitations
 */

import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { prisma } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";
import { getIO } from "../config/socketio.js";
import {
  getAllDescendantIds,
  enforcePermissionChangesBatch,
  processDelta,
  getResourceType,
} from "../helpers/invitationHelpers.js";

const redis = getRedisClient();
const io = getIO();

/**
 * POST /api/invitations/:resourceId/invite
 * Send bulk invitations (delta-based: [{ email, previous_mode, modified_mode }])
 */
export const sendInvitations = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const deltaArray = req.body;
  const adminId = req.user.id;

  const resource = await prisma.fileMeta.findUnique({
    where: { id: resourceId },
    include: { collaboratorDetail: true, project: true },
  });

  if (!resource) throw new AppError("Resource not found", 404);
  if (resource.collaboratorDetail?.adminId !== adminId) {
    throw new AppError("Only admin can send invitations", 403);
  }

  const changes = await processDelta(deltaArray);
  const descendantIds = await getAllDescendantIds(resourceId);

  await prisma.$transaction(async (tx) => {
    // New invitations
    for (const invite of changes.newInvites) {
      await tx.notification.create({
        data: {
          receiverId: invite.userId,
          senderId: adminId,
          type: "INVITE",
          status: "PENDING",
          message: JSON.stringify({
            resourceId,
            resourceType: await getResourceType(resourceId),
            mode: invite.mode,
            resourceName: resource.name,
          }),
        },
      });

      io.to(`user:${invite.userId}`).emit("NEW_INVITATION", {
        senderName: req.user.name,
        resourceName: resource.name,
        mode: invite.mode,
      });
    }

    // Revokes (remove from all descendants)
    for (const revoke of changes.revokes) {
      for (const fileMetaId of descendantIds) {
        const collab = await tx.collaboratorDetail.findUnique({
          where: { fileMetaId },
        });
        if (collab) {
          await tx.collaboratorDetail.update({
            where: { fileMetaId },
            data: {
              editors: collab.editors.filter(id => id !== revoke.userId),
              viewers: collab.viewers.filter(id => id !== revoke.userId),
            },
          });
        }
      }
      await enforcePermissionChangesBatch([revoke.userId], descendantIds, "REVOKE", null);
      io.to(`user:${revoke.userId}`).emit("INVITATION_REVOKED", {
        resourceName: resource.name,
      });
    }

    // Downgrades (editor → viewer)
    for (const downgrade of changes.downgrades) {
      for (const fileMetaId of descendantIds) {
        const collab = await tx.collaboratorDetail.findUnique({
          where: { fileMetaId },
        });
        if (collab?.editors.includes(downgrade.userId)) {
          await tx.collaboratorDetail.update({
            where: { fileMetaId },
            data: {
              editors: collab.editors.filter(id => id !== downgrade.userId),
              viewers: Array.from(new Set([...collab.viewers, downgrade.userId])),
            },
          });
        }
      }
      await enforcePermissionChangesBatch([downgrade.userId], descendantIds, "DOWNGRADE", downgrade.newMode);
    }

    // Upgrades (viewer → editor)
    for (const upgrade of changes.upgrades) {
      for (const fileMetaId of descendantIds) {
        const collab = await tx.collaboratorDetail.findUnique({
          where: { fileMetaId },
        });
        if (collab) {
          await tx.collaboratorDetail.update({
            where: { fileMetaId },
            data: {
              viewers: collab.viewers.filter(id => id !== upgrade.userId),
              editors: Array.from(new Set([...collab.editors, upgrade.userId])),
            },
          });
        }
      }
    }
  });

  io.to(`project:${resource.projectId}`).emit("COLLABORATORS_UPDATED", {
    resourceId,
    resourceName: resource.name,
    changes,
  });

  res.json({
    success: true,
    message: "Invitations processed",
    stats: {
      newInvites: changes.newInvites.length,
      revokes: changes.revokes.length,
      downgrades: changes.downgrades.length,
      upgrades: changes.upgrades.length,
    },
  });
});
/**
 * POST /api/invitations/respond/:notifId
 * User accepts or rejects an invitation
 */
export const respondToInvitation = asyncHandler(async (req, res) => {
  const { notifId } = req.params;
  const { action } = req.body;
  const userId = req.user.id;

  const notification = await prisma.notification.findUnique({
    where: { id: notifId },
  });

  if (!notification || notification.receiverId !== userId) {
    throw new AppError("Invalid notification", 401);
  }

  if (notification.status !== "PENDING") {
    throw new AppError("Invitation already processed", 400);
  }

  if (action === "ACCEPT") {
    const metadata = JSON.parse(notification.message);
    const { resourceId, mode } = metadata;

    const resource = await prisma.fileMeta.findUnique({
      where: { id: resourceId },
      include: { project: true },
    });

    if (!resource) throw new AppError("Resource no longer exists", 404);

    await prisma.$transaction(async (tx) => {
      const collab = await tx.collaboratorDetail.findUnique({
        where: { fileMetaId: resourceId },
      });

      if (collab) {
        if (mode === "EDITOR") {
          collab.editors.push(userId);
        } else {
          collab.viewers.push(userId);
        }

        await tx.collaboratorDetail.update({
          where: { fileMetaId: resourceId },
          data: {
            editors: collab.editors,
            viewers: collab.viewers,
          },
        });
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user.accessibleProjectIds.includes(resource.projectId)) {
        await tx.user.update({
          where: { id: userId },
          data: {
            accessibleProjectIds: [...user.accessibleProjectIds, resource.projectId],
          },
        });
      }

      await tx.notification.update({
        where: { id: notifId },
        data: { status: "ACCEPTED" },
      });
    });

    io.to(`project:${resource.projectId}`).emit("COLLABORATOR_JOINED", {
      userId,
      userName: req.user.name,
      resourceName: resource.name,
      mode,
    });

    res.json({
      success: true,
      message: "Invitation accepted",
      projectId: resource.projectId,
    });
  } else {
    await prisma.notification.update({
      where: { id: notifId },
      data: { status: "REJECTED" },
    });

    res.json({
      success: true,
      message: "Invitation rejected",
    });
  }
});

/**
 * POST /api/invitations/revoke/:fileMetaId
 * User removes themselves from a resource (and all nested children)
 */
export const userSelfRevoke = asyncHandler(async (req, res) => {
  const { fileMetaId } = req.params;
  const userId = req.user.id;

  const resource = await prisma.fileMeta.findUnique({
    where: { id: fileMetaId },
    include: { project: true },
  });

  if (!resource) throw new AppError("Resource not found", 404);

  const descendantIds = await getAllDescendantIds(fileMetaId);

  await prisma.$transaction(async (tx) => {
    for (const descendantId of descendantIds) {
      const collab = await tx.collaboratorDetail.findUnique({
        where: { fileMetaId: descendantId },
      });

      if (collab) {
        await tx.collaboratorDetail.update({
          where: { fileMetaId: descendantId },
          data: {
            editors: collab.editors.filter(id => id !== userId),
            viewers: collab.viewers.filter(id => id !== userId),
          },
        });
      }
    }
  });

  await enforcePermissionChangesBatch([userId], descendantIds, "REVOKE", null);

  io.to(`project:${resource.projectId}`).emit("COLLABORATOR_LEFT", {
    userId,
    userName: req.user.name,
    resourceName: resource.name,
  });

  res.json({
    success: true,
    message: "You have been removed from this resource",
  });
});

/**
 * GET /api/invitations/:resourceId/collaborators
 * Fetch existing collaborators for invite modal (Admin only)
 */
export const getCollaborators = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const userId = req.user.id;

  const collab = await prisma.collaboratorDetail.findUnique({
    where: { fileMetaId: resourceId },
    include: { fileMeta: { select: { name: true } } },
  });

  if (!collab) throw new AppError("Collaborators not found", 404);

  const isAdmin = collab.adminId === userId;

  if (!isAdmin) {
    throw new AppError("Only admin can view collaborators", 403);
  }

  const editorUsers = await prisma.user.findMany({
    where: { id: { in: collab.editors } },
    select: { id: true, name: true, email: true },
  });

  const viewerUsers = await prisma.user.findMany({
    where: { id: { in: collab.viewers } },
    select: { id: true, name: true, email: true },
  });

  res.json({
    success: true,
    resourceName: collab.fileMeta.name,
    isAdmin,
    collaborators: {
      admin: await prisma.user.findUnique({
        where: { id: collab.adminId },
        select: { id: true, name: true, email: true },
      }),
      editors: editorUsers,
      viewers: viewerUsers,
    },
  });
});