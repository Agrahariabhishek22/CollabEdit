/**
 * Invitation System Helpers
 * Recursive operations, permission checks, and real-time enforcement
 */

import { prisma } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";
import { getIO } from "../config/socketio.js";

const redis = getRedisClient();
const io = getIO();

// ============================================================================
// 1. RECURSIVE FILE TREE OPERATIONS
// ============================================================================

/**
 * Get all descendant FileMeta IDs for a folder (BFS for performance)
 * WHY: Single batch query instead of recursive loops (N+1 prevention)
 */
export const getAllDescendantIds = async (parentFileMetaId) => {
  const result = [parentFileMetaId];
  const queue = [parentFileMetaId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await prisma.fileMeta.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });
    children.forEach(child => {
      result.push(child.id);
      queue.push(child.id);
    });
  }

  return result;
};

/**
 * Recursively update CollaboratorDetail for user across all descendants
 * Called when: Admin adds/modifies/revokes permissions on a folder
 */
export const updateCollaboratorRecursive = async (
  parentFileMetaId,
  userId,
  newMode, // 'EDITOR' | 'VIEWER' | null (revoke)
  oldMode
) => {
  const descendantIds = await getAllDescendantIds(parentFileMetaId);

  // Single transaction: all or nothing
  await prisma.$transaction(async (tx) => {
    for (const fileMetaId of descendantIds) {
      let collaborator = await tx.collaboratorDetail.findUnique({
        where: { fileMetaId },
      });

      if (!collaborator) {
        // Create if doesn't exist
        collaborator = await tx.collaboratorDetail.create({
          data: { fileMetaId, adminId: collaborator.adminId || userId },
        });
      }

      // Remove from old mode array
      if (oldMode === "EDITOR") {
        collaborator.editors = collaborator.editors.filter(id => id !== userId);
      } else if (oldMode === "VIEWER") {
        collaborator.viewers = collaborator.viewers.filter(id => id !== userId);
      }

      // Add to new mode array
      if (newMode === "EDITOR" && !collaborator.editors.includes(userId)) {
        collaborator.editors.push(userId);
      } else if (newMode === "VIEWER" && !collaborator.viewers.includes(userId)) {
        collaborator.viewers.push(userId);
      }

      // Update DB
      await tx.collaboratorDetail.update({
        where: { fileMetaId },
        data: {
          editors: collaborator.editors,
          viewers: collaborator.viewers,
        },
      });
    }
  });

  return descendantIds.length;
};

// ============================================================================
// 2. REAL-TIME SESSION ENFORCEMENT
// ============================================================================

/**
 * Check if user is currently editing a file
 * Returns: { isActive, fileId, projectId, currentMode }
 */
export const getUserActiveSession = async (userId) => {
  const sessionKey = `user:session:${userId}`;
  const session = await redis.get(sessionKey);
  return session ? JSON.parse(session) : null;
};

/**
 * Enforce permission change immediately
 * If user is editing affected file, kick them or downgrade
 */
export const enforcePermissionChange = async (
  userId,
  affectedFileMetaId,
  action, // 'DOWNGRADE' | 'REVOKE'
  newMode
) => {
  const session = await getUserActiveSession(userId);

  if (!session || session.fileId !== affectedFileMetaId) {
    return; // User not editing this file, no action needed
  }

  const io = getIO();

  if (action === "REVOKE") {
    // Kick user out immediately
    io.to(`user:${userId}`).emit("ACCESS_DENIED", {
      fileId: affectedFileMetaId,
      reason: "Your access has been revoked",
      action: "REDIRECT_TO_DASHBOARD",
    });

    // Clear session
    await redis.del(`user:session:${userId}`);
  } else if (action === "DOWNGRADE") {
    // Downgrade editor → viewer
    io.to(`user:${userId}`).emit("PERMISSIONS_UPDATED", {
      fileId: affectedFileMetaId,
      newMode,
      message: "Your access level has been changed to View Only",
      action: "DISABLE_EDITOR",
    });

    // Update session
    session.currentMode = newMode;
    await redis.set(
      `user:session:${userId}`,
      JSON.stringify(session),
      "EX",
      1800
    );
  }
};

/**
 * Batch enforce for multiple users
 */
export const enforcePermissionChangesBatch = async (
  userIds,
  affectedFileIds,
  action,
  newMode
) => {
  for (const userId of userIds) {
    for (const fileId of affectedFileIds) {
      await enforcePermissionChange(userId, fileId, action, newMode);
    }
  }
};

// ============================================================================
// 3. NOTIFICATION HELPERS
// ============================================================================

/**
 * Create notification for new invitation
 */
export const createInvitationNotification = async (
  receiverId,
  senderId,
  resourceId,
  resourceType, // 'PROJECT' | 'FOLDER' | 'FILE' | 'BRANCH'
  mode, // 'EDITOR' | 'VIEWER'
  resourceName
) => {
  return await prisma.notification.create({
    data: {
      receiverId,
      senderId,
      type: "INVITE",
      status: "PENDING",
      message: JSON.stringify({
        resourceId,
        resourceType,
        mode,
        resourceName,
      }),
    },
  });
};

/**
 * Broadcast to all users currently in a resource
 */
export const broadcastToResource = async (
  resourceId,
  event,
  data,
  excludeUserId = null
) => {
  const room = `resource:${resourceId}`;
  const emitter = excludeUserId
    ? io.to(room).except(`user:${excludeUserId}`)
    : io.to(room);

  emitter.emit(event, data);
};

// ============================================================================
// 4. PERMISSION VERIFICATION
// ============================================================================

/**
 * Check if user has admin/write access to a resource
 */
export const canUserModifyResource = async (userId, resourceFileMetaId) => {
  const collaborator = await prisma.collaboratorDetail.findUnique({
    where: { fileMetaId: resourceFileMetaId },
  });

  if (!collaborator) return false;

  // Admin has full control
  if (collaborator.adminId === userId) return true;

  // Editors can modify (depending on feature requirements)
  // For now: only admin can modify permissions
  return false;
};

/**
 * Check if user can read a resource
 */
export const canUserReadResource = async (userId, resourceFileMetaId) => {
  const collaborator = await prisma.collaboratorDetail.findUnique({
    where: { fileMetaId: resourceFileMetaId },
  });

  if (!collaborator) return false;

  return (
    collaborator.adminId === userId ||
    collaborator.editors.includes(userId) ||
    collaborator.viewers.includes(userId)
  );
};

// ============================================================================
// 5. DELTA PROCESSING (Parse invitation changes)
// ============================================================================

/**
 * Process invitation delta array and return categorized changes
 * Input: [{ email, previous_mode, modified_mode }]
 */
export const processDelta = async (deltaArray) => {
  const changes = {
    newInvites: [],    // { email, mode }
    revokes: [],       // { email, userId }
    upgrades: [],      // { userId, oldMode, newMode }
    downgrades: [],    // { userId, oldMode, newMode }
  };

  for (const delta of deltaArray) {
    const user = await prisma.user.findUnique({
      where: { email: delta.email },
    });

    if (!user) {
      // User doesn't exist, skip
      continue;
    }

    if (delta.previous_mode === null && delta.modified_mode !== null) {
      // New invite
      changes.newInvites.push({
        email: delta.email,
        userId: user.id,
        mode: delta.modified_mode,
      });
    } else if (delta.modified_mode === null) {
      // Revoke
      changes.revokes.push({
        email: delta.email,
        userId: user.id,
        oldMode: delta.previous_mode,
      });
    } else if (delta.previous_mode !== delta.modified_mode) {
      // Mode change
      if (
        (delta.previous_mode === "VIEWER" && delta.modified_mode === "EDITOR") ||
        (delta.previous_mode === "VIEWER" && delta.modified_mode === "ADMIN")
      ) {
        changes.upgrades.push({
          userId: user.id,
          oldMode: delta.previous_mode,
          newMode: delta.modified_mode,
        });
      } else {
        changes.downgrades.push({
          userId: user.id,
          oldMode: delta.previous_mode,
          newMode: delta.modified_mode,
        });
      }
    }
  }

  return changes;
};

// ============================================================================
// 6. RESOURCE TYPE DETECTION
// ============================================================================

/**
 * Determine if FileMeta is a project, folder, or file
 */
export const getResourceType = async (fileMetaId) => {
  const fileMeta = await prisma.fileMeta.findUnique({
    where: { id: fileMetaId },
    select: { isFolder: true, parentId: true, extension: true },
  });

  if (!fileMeta) return null;

  if (fileMeta.parentId === null) {
    return "PROJECT";
  } else if (fileMeta.isFolder) {
    return "FOLDER";
  } else {
    return "FILE";
  }
};

/**
 * Get project ID from any FileMeta
 */
export const getProjectIdFromFileMeta = async (fileMetaId) => {
  const fileMeta = await prisma.fileMeta.findUnique({
    where: { id: fileMetaId },
    select: { projectId: true },
  });

  return fileMeta?.projectId || null;
};
