// socket/handlers/permission.handler.js

class PermissionHandler {
  constructor(io, roleChangeHandler, sessionManager, redis) {
    this.io = io;
    this.roleChangeHandler = roleChangeHandler;
    this.sessionManager = sessionManager;
    this.redis = redis;
  }

  register(socket) {
    // ═══════════════════════════════════════════════════════════
    // CHANGE USER ROLE (Admin only)
    // ═══════════════════════════════════════════════════════════

    socket.on('permission:change-role', async (data) => {
      await this.handleChangeRole(socket, data);
    });

    // ═══════════════════════════════════════════════════════════
    // REVOKE ACCESS (Admin only)
    // ═══════════════════════════════════════════════════════════

    socket.on('permission:revoke', async (data) => {
      await this.handleRevokeAccess(socket, data);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHANGE ROLE (EDITOR → VIEWER, etc.)
  // ═══════════════════════════════════════════════════════════

  async handleChangeRole(socket, { fileId, targetUserId, newMode }) {
    const { userId: adminId, userName: adminName } = socket;

    try {
      // Step 1: Validate admin has permission
      const validation = await this.permissionValidator.validateAction(
        adminId,
        fileId,
        'SHARE' // Only admins can change roles
      );

      if (!validation.allowed) {
        return socket.emit('permission:error', {
          message: 'Only admins can change user roles',
        });
      }

      // Step 2: Execute role change
      const result = await this.roleChangeHandler.updateUserRole(
        fileId,
        targetUserId,
        newMode,
        adminId
      );

      // Step 3: Get target user's socket
      const targetSocketId = await this.sessionManager.getSocketId(targetUserId);

      if (targetSocketId) {
        const targetSocket = this.io.sockets.sockets.get(targetSocketId);

        if (targetSocket) {
          // Step 4: Send notification to target user
          targetSocket.emit('permission:changed', {
            fileId,
            newMode,
            changedBy: adminName,
            message: `Your access level changed to ${newMode}`,
            action: result.action, // 'DISABLE_EDITING' | 'ENABLE_EDITING'
          });

          // Step 5: If downgraded to VIEWER, make editor read-only IMMEDIATELY
          if (newMode === 'VIEWER') {
            targetSocket.emit('editor:set-readonly', {
              fileId,
              readonly: true,
            });
          } else if (newMode === 'EDITOR' || newMode === 'ADMIN') {
            targetSocket.emit('editor:set-readonly', {
              fileId,
              readonly: false,
            });
          }
        }
      }

      // Step 6: Broadcast to all users in file
      this.io.to(`file:${fileId}`).emit('participant:role-changed', {
        fileId,
        userId: targetUserId,
        newMode,
        changedBy: adminName,
      });

      // Step 7: Confirm to admin
      socket.emit('permission:role-changed', {
        fileId,
        targetUserId,
        newMode,
        success: true,
      });

      console.log(`[Permission] ${adminName} changed ${targetUserId} to ${newMode} on ${fileId}`);

    } catch (err) {
      console.error('[Permission] Change role error:', err);
      socket.emit('permission:error', {
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // REVOKE ACCESS (Force disconnect)
  // ═══════════════════════════════════════════════════════════

  async handleRevokeAccess(socket, { fileId, targetUserId }) {
    const { userId: adminId, userName: adminName } = socket;

    try {
      // Step 1: Validate admin permission
      const validation = await this.permissionValidator.validateAction(
        adminId,
        fileId,
        'SHARE'
      );

      if (!validation.allowed) {
        return socket.emit('permission:error', {
          message: 'Only admins can revoke access',
        });
      }

      // Step 2: Execute revoke
      await this.roleChangeHandler.revokeAccess(fileId, targetUserId, adminId);

      // Step 3: Force close editor on target user's screen
      const targetSocketId = await this.sessionManager.getSocketId(targetUserId);

      if (targetSocketId) {
        const targetSocket = this.io.sockets.sockets.get(targetSocketId);

        if (targetSocket) {
          // Force close file
          targetSocket.emit('permission:revoked', {
            fileId,
            message: 'Your access has been revoked by an admin',
            action: 'FORCE_CLOSE',
          });

          // Force leave room
          targetSocket.leave(`file:${fileId}`);
        }
      }

      // Step 4: Remove from file session
      await this.sessionManager.leaveFileSession(fileId, targetUserId, '*');

      // Step 5: Broadcast to others
      this.io.to(`file:${fileId}`).emit('participant:removed', {
        fileId,
        userId: targetUserId,
        revokedBy: adminName,
      });

      // Step 6: Confirm to admin
      socket.emit('permission:revoked-success', {
        fileId,
        targetUserId,
      });

      console.log(`[Permission] ${adminName} revoked access for ${targetUserId} on ${fileId}`);

    } catch (err) {
      console.error('[Permission] Revoke error:', err);
      socket.emit('permission:error', {
        message: err.message,
      });
    }
  }
}

export default PermissionHandler;