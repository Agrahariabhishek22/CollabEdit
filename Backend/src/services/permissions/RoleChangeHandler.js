// services/permissions/RoleChangeHandler.js

export default class RoleChangeHandler {
  constructor(prisma, redis, sessionManager, io) {
    this.prisma = prisma;
    this.redis = redis;
    this.sessionManager = sessionManager;
    this.io = io;
  }

  /**
   * SCENARIO 1: Admin changes user role (EDITOR → VIEWER)
   * 
   * Flow:
   * 1. Update DB (CollaboratorDetail)
   * 2. Update Redis cache
   * 3. Broadcast to affected user
   * 4. If downgraded, revoke editing capability LIVE
   */
  async updateUserRole(fileId, targetUserId, newMode, changedBy) {
    // Step 1: Update Database
    await this.prisma.collaboratorDetail.update({
      where: { fileMetaId: fileId },
      data: this.buildRoleUpdateQuery(targetUserId, newMode),
    });

    // Step 2: Update Redis session
    const sessionData = await this.redis.hget(
      `file_session:${fileId}`,
      targetUserId
    );

    if (sessionData) {
      const participant = JSON.parse(sessionData);
      const oldMode = participant.accessMode;
      participant.accessMode = newMode;
      participant.modeChangedAt = Date.now();

      await this.redis.hset(
        `file_session:${fileId}`,
        targetUserId,
        JSON.stringify(participant)
      );

      // Step 3: Notify target user
      const socketId = await this.sessionManager.getSocketId(targetUserId);
      if (socketId) {
        this.io.to(socketId).emit('permission:changed', {
          fileId,
          oldMode,
          newMode,
          changedBy,
          message: `Your access level changed: ${oldMode} → ${newMode}`,
          action: this.getRequiredAction(oldMode, newMode),
        });
      }

      // Step 4: Broadcast to others
      this.io.to(`file:${fileId}`).emit('participant:role-changed', {
        userId: targetUserId,
        newMode,
      });
    }

    return { success: true, newMode };
  }

  /**
   * SCENARIO 2: Access revoked completely
   */
  async revokeAccess(fileId, targetUserId, revokedBy) {
    // Step 1: Remove from DB
    await this.prisma.collaboratorDetail.update({
      where: { fileMetaId: fileId },
      data: {
        editors: { set: [] }, // Remove from all arrays
        viewers: { set: [] },
      },
    });

    // Step 2: Force disconnect from file session
    await this.sessionManager.leaveFileSession(fileId, targetUserId, '*');

    // Step 3: Delete from Redis
    await this.redis.hdel(`file_session:${fileId}`, targetUserId);

    // Step 4: Force close editor on user's screen
    const socketId = await this.sessionManager.getSocketId(targetUserId);
    if (socketId) {
      this.io.to(socketId).emit('permission:revoked', {
        fileId,
        message: 'Your access to this file has been revoked',
        action: 'FORCE_CLOSE', // Frontend must close editor
      });
    }

    return { success: true, action: 'REVOKED' };
  }

  /**
   * Helper: Determine frontend action based on role change
   */
  getRequiredAction(oldMode, newMode) {
    if (newMode === 'VIEWER' && oldMode !== 'VIEWER') {
      return 'DISABLE_EDITING'; // Make editor read-only
    }
    if (newMode === 'EDITOR' && oldMode === 'VIEWER') {
      return 'ENABLE_EDITING'; // Enable editing
    }
    return 'REFRESH_UI'; // General UI update
  }

  /**
   * Helper: Build Prisma update query for role change
   */
  buildRoleUpdateQuery(userId, newMode) {
    // Remove from all arrays first
    const removeFromAll = {
      editors: { set: [] },
      viewers: { set: [] },
    };

    // Add to appropriate array
    if (newMode === 'EDITOR') {
      return {
        ...removeFromAll,
        editors: { push: userId },
      };
    } else if (newMode === 'VIEWER') {
      return {
        ...removeFromAll,
        viewers: { push: userId },
      };
    } else if (newMode === 'ADMIN') {
      return {
        ...removeFromAll,
        adminId: userId,
      };
    }

    return removeFromAll; // Revoke all
  }
}

