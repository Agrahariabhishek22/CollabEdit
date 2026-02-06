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


/**
 * HELPER: Create ProjectLog entry for invitation operations
 */
async function logInvitationAction(projectId, userId, actionType, details) {
  try {
    await prisma.projectLog.create({
      data: {
        projectId,
        userId,
        actionType,
        details,
      },
    });
  } catch (error) {
    console.warn("ProjectLog creation warning:", error.message);
    // Don't throw - logging is non-critical
  }
}

/**
 * POST /api/invitations/:resourceId/invite
 * Send bulk invitations (delta-based: [{ email, previous_mode, modified_mode }])
 */
export const sendInvitations = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const deltaArray = req.body;
  const adminId = req.user.id;
  const io = getIO();
  console.log(deltaArray);

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
      console.log(invite);
      
      // Create detailed notification for RECEIVER
      const receiverNotif = await tx.notification.create({
        data: {
          receiverId: invite.userId,
          senderId: adminId,
          type: "INVITE_RECEIVED",
          status: "PENDING",
          resourceId,
          resourceName: resource.name,
          resourceType: await getResourceType(resourceId),
          actionMode: invite.mode,
          message: JSON.stringify({
            resourceId,
            resourceType: await getResourceType(resourceId),
            mode: invite.mode,
            resourceName: resource.name,
            senderName: req.user.name,
            message:"You are being invited to collaborate on "+resource.name+" as "+invite.mode+" by "+req.user.name,
          }),
        },
      });
      console.log(receiverNotif);
      

      // Log: INVITE_SENT
      await tx.projectLog.create({
        data: {
          projectId: resource.projectId,
          userId: adminId,
          actionType: "INVITE_SENT",
          fileMetaId: resourceId,
          fileName: resource.name,
          details: {
            targetUserEmail: invite.email,
            mode: invite.mode,
            resourceName: resource.name,
          },
        },
      });

      // Socket to RECEIVER
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
              editors: collab.editors.filter((id) => id !== revoke.userId),
              viewers: collab.viewers.filter((id) => id !== revoke.userId),
            },
          });
        }
      }

      // EDGE CASE: Mark any pending INVITE_RECEIVED for this user as revoked
      const pendingInvite = await tx.notification.findFirst({
        where: {
          receiverId: revoke.userId,
          senderId: adminId,
          resourceId,
          type: "INVITE_RECEIVED",
          status: "PENDING",
        },
      });

      if (pendingInvite) {
        await tx.notification.update({
          where: { id: pendingInvite.id },
          data: {
            isRevoked: true,
            revokedAt: new Date(),
          },
        });
      }

      // Create ACCESS_REVOKED notification for RECEIVER
      const revokedNotif = await tx.notification.create({
        data: {
          receiverId: revoke.userId,
          senderId: adminId,
          type: "ACCESS_REVOKED",
          status: "READ",
          resourceId,
          resourceName: resource.name,
          resourceType: await getResourceType(resourceId),
          message: JSON.stringify({
            resourceId,
            resourceName: resource.name,
            message: `Your access to ${resource.name} has been revoked by the admin.`,
          }),
        },
      });

      // Log: INVITE_REVOKED
      await tx.projectLog.create({
        data: {
          projectId: resource.projectId,
          userId: adminId,
          actionType: "INVITE_REVOKED",
          fileMetaId: resourceId,
          fileName: resource.name,
          details: {
            targetUserEmail: revoke.email,
            resourceName: resource.name,
          },
        },
      });

      await enforcePermissionChangesBatch(
        [revoke.userId],
        descendantIds,
        "REVOKE",
        null,
      );
      
      // Socket to REVOKED user (receiver)
      io.to(`user:${revoke.userId}`).emit("INVITATION_REVOKED", {
        resourceName: resource.name,
      });

      // Socket to ADMIN (sender gets notification update)
      io.to(`user:${adminId}`).emit("NOTIF_STATUS_UPDATED", {
        id: revokedNotif.id,
        type: "ACCESS_REVOKED",
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
              editors: collab.editors.filter((id) => id !== downgrade.userId),
              viewers: Array.from(
                new Set([...collab.viewers, downgrade.userId]),
              ),
            },
          });
        }
      }

      // Create ACCESS_DOWNGRADED notification for RECEIVER
      const downgradedNotif = await tx.notification.create({
        data: {
          receiverId: downgrade.userId,
          senderId: adminId,
          type: "ACCESS_DOWNGRADED",
          status: "READ",
          resourceId,
          resourceName: resource.name,
          resourceType: await getResourceType(resourceId),
          oldMode: "EDITOR",
          actionMode: "VIEWER",
          message: JSON.stringify({
            resourceId,
            resourceName: resource.name,
            oldMode: "EDITOR",
            newMode: "VIEWER",
            message: `Your access to ${resource.name} has been downgraded to View Only.`,
          }),
        },
      });

      // Log: PERMISSION_DOWNGRADED
      await tx.projectLog.create({
        data: {
          projectId: resource.projectId,
          userId: adminId,
          actionType: "PERMISSION_DOWNGRADED",
          fileMetaId: resourceId,
          fileName: resource.name,
          details: {
            targetUserEmail: downgrade.email,
            oldMode: "EDITOR",
            newMode: "VIEWER",
            resourceName: resource.name,
          },
        },
      });

      await enforcePermissionChangesBatch(
        [downgrade.userId],
        descendantIds,
        "DOWNGRADE",
        downgrade.newMode,
      );

      // Socket to DOWNGRADED user
      io.to(`user:${downgrade.userId}`).emit("NOTIF_STATUS_UPDATED", {
        type: "ACCESS_DOWNGRADED",
        message: `Your access to ${resource.name} has been downgraded to Viewer`,
      });
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
              viewers: collab.viewers.filter((id) => id !== upgrade.userId),
              editors: Array.from(new Set([...collab.editors, upgrade.userId])),
            },
          });
        }
      }

      // Create ACCESS_UPGRADED notification for RECEIVER
      const upgradedNotif = await tx.notification.create({
        data: {
          receiverId: upgrade.userId,
          senderId: adminId,
          type: "ACCESS_UPGRADED",
          status: "READ",
          resourceId,
          resourceName: resource.name,
          resourceType: await getResourceType(resourceId),
          oldMode: "VIEWER",
          actionMode: "EDITOR",
          message: JSON.stringify({
            resourceId,
            resourceName: resource.name,
            oldMode: "VIEWER",
            newMode: "EDITOR",
            message: `Your access to ${resource.name} has been upgraded to Editor.`,
          }),
        },
      });

      // Log: PERMISSION_UPGRADED
      await tx.projectLog.create({
        data: {
          projectId: resource.projectId,
          userId: adminId,
          actionType: "PERMISSION_UPGRADED",
          fileMetaId: resourceId,
          fileName: resource.name,
          details: {
            targetUserEmail: upgrade.email,
            oldMode: "VIEWER",
            newMode: "EDITOR",
            resourceName: resource.name,
          },
        },
      });

      // Socket to UPGRADED user
      io.to(`user:${upgrade.userId}`).emit("NOTIF_STATUS_UPDATED", {
        type: "ACCESS_UPGRADED",
        message: `Your access to ${resource.name} has been upgraded to Editor`,
      });
    }
  });

  io.to(`project:${resource.id}`).emit("COLLABORATORS_UPDATED", {
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


// will be using to handle invitation repsonse
export const respondToInvitation = asyncHandler(async (req, res) => {
  const { notifId } = req.params;
  const { action } = req.body;
  const userId = req.user.id;
  const io = getIO();

  const notification = await prisma.notification.findUnique({
    where: { id: notifId },
    include: { sender: true },
  });

  if (!notification || notification.receiverId !== userId) {
    throw new AppError("Invalid notification", 401);
  }

  if (notification.status !== "PENDING") {
    throw new AppError("Invitation already processed", 400);
  }

  // EDGE CASE: Check if invitation was revoked by sender
  if (notification.isRevoked) {
    throw new AppError("This invitation has been revoked and can no longer be responded to", 403);
  }

  if (action === "ACCEPT") {
    const metadata = JSON.parse(notification.message);
    const { resourceId, mode } = metadata;

    const resource = await prisma.fileMeta.findUnique({
      where: { id: resourceId },
      include: { project: true },
    });

    if (!resource) throw new AppError("Resource no longer exists", 404);

    // 1. Get all nested children (Descendants) for this folder/file
    const descendantIds = await getAllDescendantIds(resourceId);

    await prisma.$transaction(async (tx) => {
      // 2. Loop through the parent and all descendants to update permissions
      for (const fileId of descendantIds) {
        const collab = await tx.collaboratorDetail.findUnique({
          where: { fileMetaId: fileId },
        });

        if (collab) {
          const updateData = {};
          if (mode === "EDITOR") {
            updateData.editors = Array.from(
              new Set([...collab.editors, userId]),
            );
            updateData.viewers = collab.viewers.filter((id) => id !== userId);
          } else {
            updateData.viewers = Array.from(
              new Set([...collab.viewers, userId]),
            );
            updateData.editors = collab.editors.filter((id) => id !== userId);
          }

          await tx.collaboratorDetail.update({
            where: { fileMetaId: fileId },
            data: updateData,
          });
        }
      }

      // 3. Update user's accessible projects list
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user.accessibleProjectIds.includes(resourceId)) {
        await tx.user.update({
          where: { id: userId },
          data: {
            accessibleProjectIds: [
              ...user.accessibleProjectIds,
              resourceId,
            ],
          },
        });
      }

      // 4. Mark notification as ACCEPTED
      await tx.notification.update({
        where: { id: notifId },
        data: { status: "ACCEPTED" },
      });

      // 5. Create COLLAB_JOINED notification for SENDER (receiver accepted)
      const senderNotif = await tx.notification.create({
        data: {
          receiverId: notification.senderId,
          senderId: userId,
          type: "COLLAB_JOINED",
          status: "READ",
          resourceId,
          resourceName: resource.name,
          resourceType: await getResourceType(resourceId),
          actionMode: mode,
          message: JSON.stringify({
            resourceId,
            resourceName: resource.name,
            message: `${req.user.name} accepted your invitation to collaborate on ${resource.name} as ${mode}`,
          }),
        },
      });

      // 6. Log: INVITE_ACCEPTED
      await tx.projectLog.create({
        data: {
          projectId: resource.projectId,
          userId,
          actionType: "INVITE_ACCEPTED",
          fileMetaId: resourceId,
          fileName: resource.name,
          details: {
            resourceName: resource.name,
            mode,
            acceptedBy: req.user.name,
          },
        },
      });
    });

    // Socket to all users in the project (COLLABORATOR_JOINED)
    io.to(`project:${resource.projectId}`).emit("COLLABORATOR_JOINED", {
      userId,
      userName: req.user.name,
      resourceName: resource.name,
      mode,
    });

    // Socket to SENDER (receiver accepted)
    io.to(`user:${notification.senderId}`).emit("NOTIF_STATUS_UPDATED", {
      type: "COLLAB_JOINED",
      message: `${req.user.name} accepted your invite`,
    });

    res.json({
      success: true,
      message: "Invitation accepted and access propagated to all nested items",
      projectId: resource.projectId,
      resourceId: resource.id,
    });
  } else if (action === "DECLINE") {
    // DECLINE: Create INVITE_DECLINED notification for SENDER
    const declineNotif = await prisma.notification.create({
      data: {
        receiverId: notification.senderId,
        senderId: userId,
        type: "INVITE_DECLINED",
        status: "READ",
        resourceId: notification.resourceId,
        resourceName: notification.resourceName,
        resourceType: notification.resourceType,
        message: JSON.stringify({
          resourceId: notification.resourceId,
          resourceName: notification.resourceName,
          message: `${req.user.name} declined your invitation to ${notification.resourceName}`,
        }),
      },
    });

    // Update receiver notification to DECLINED
    await prisma.notification.update({
      where: { id: notifId },
      data: { status: "DECLINED" },
    });

    // Log: INVITE_DECLINED
    // await prisma.projectLog.create({
    //   data: {
    //     projectId: notification.resourceId,
    //     userId,
    //     actionType: "INVITE_DECLINED",
    //     fileName: notification.resourceName,
    //     details: {
    //       resourceName: notification.resourceName,
    //       declinedBy: req.user.name,
    //     },
    //   },
    // });

    // Socket to SENDER (receiver declined)
    io.to(`user:${notification.senderId}`).emit("NOTIF_STATUS_UPDATED", {
      type: "INVITE_DECLINED",
      message: `${req.user.name} declined your invite`,
    });

    res.json({
      success: true,
      message: "Invitation declined",
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
  const io = getIO();

  // 1. Pehle ye dekho ki ye resource exist karta hai ya nahi
  const resource = await prisma.fileMeta.findUnique({
    where: { id: fileMetaId },
  });

  if (!resource) throw new AppError("Resource not found", 404);

  // 2. Descendants nikal lo (Recursive delete ke liye mandatory hai)
  const descendantIds = await getAllDescendantIds(fileMetaId);

  await prisma.$transaction(async (tx) => {
    // 3. Sabhi nested files/folders se user ko nikalo
    for (const id of descendantIds) {
      const collab = await tx.collaboratorDetail.findUnique({
        where: { fileMetaId: id },
      });

      if (collab) {
        await tx.collaboratorDetail.update({
          where: { fileMetaId: id },
          data: {
            editors: collab.editors.filter((uid) => uid !== userId),
            viewers: collab.viewers.filter((uid) => uid !== userId),
          },
        });
      }
    }

    // 4. NEW LOGIC: Check if this fileMeta is a Project's Root
    // Agar user ne "Root Folder" choda hai, matlab usne poora project choda hai
    // const project = await tx.project.findUnique({
    //   where: { rootFileMetaId: fileMetaId },
    // });

    // if (project) {
      const user = await tx.user.findUnique({ where: { id: userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          accessibleProjectIds: user.accessibleProjectIds.filter(
            (pid) => pid !== fileMetaId,
          ),
        },
      });
      if (adminId !== userId) { // Self-notification prevent karo
      await tx.notification.create({
        data: {
          receiverId: adminId,
          senderId: userId,
          type: "COLLAB_LEFT", // Make sure ye type NotifType enum mein ho
          status: "PENDING",
          resourceId: fileMetaId,
          resourceName: resource.name,
          resourceType: resource.isFolder ? "FOLDER" : "FILE",
          message: JSON.stringify({
            resourceId: fileMetaId,
            resourceName: resource.name,
            message: `${req.user.name} has left the ${resource.isFolder ? 'folder' : 'file'} "${resource.name}"`,
          }),
        },
      });
    }
    // }
  });

  // 5. Redis Enforcement & Socket Emission
  await enforcePermissionChangesBatch([userId], descendantIds, "REVOKE", null);

  // BroadCast to the specific resource room
  io.to(`resource:${fileMetaId}`).emit("COLLABORATOR_LEFT", {
    userId,
    userName: req.user.name,
    resourceName: resource.name,
  });

  res.json({
    success: true,
    message: "Access revoked from this hierarchy successfully",
  });
});

/**
 * GET /api/invitations/:resourceId/collaborators
 * Fetch existing collaborators for invite modal (Admin only)
 */
export const getCollaborators = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const userId = req.user.id;
  const io = getIO();

  // 1. Fetch CollaboratorDetail along with basic meta info
  const collab = await prisma.collaboratorDetail.findUnique({
    where: { fileMetaId: resourceId },
    include: {
      fileMeta: {
        select: {
          name: true,
          projectId: true,
        },
      },
    },
  });

  if (!collab) throw new AppError("Collaborators not found", 404);

  // 2. Permission Logic: User must be Admin, Editor, or Viewer to see this list
  const isAdmin = collab.adminId === userId;
  const isEditor = collab.editors.includes(userId);
  const isViewer = collab.viewers.includes(userId);

  if (!isAdmin && !isEditor && !isViewer) {
    throw new AppError(
      "You don't have permission to view collaborators for this resource",
      403,
    );
  }

  // 3. Batch Fetch Users: Saare IDs ko ek array mein dalo (Optimization)
  const allUserIds = Array.from(
    new Set([collab.adminId, ...collab.editors, ...collab.viewers]),
  );

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, name: true, email: true },
  });

  // 4. Map users back to their roles
  const userMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  res.json({
    success: true,
    resourceName: collab.fileMeta.name,
    projectId: collab.fileMeta.projectId,
    userRole: isAdmin ? "ADMIN" : isEditor ? "EDITOR" : "VIEWER",
    collaborators: {
      admin: userMap[collab.adminId] || null,
      editors: collab.editors.map((id) => userMap[id]).filter(Boolean),
      viewers: collab.viewers.map((id) => userMap[id]).filter(Boolean),
    },
  });
});
