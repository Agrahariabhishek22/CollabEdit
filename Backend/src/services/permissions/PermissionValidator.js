export default class PermissionValidator {
  constructor(prisma, redis, sessionManager, io) {
    this.prisma = prisma;
    this.redis = redis;
    this.sessionManager = sessionManager;
    this.io = io;
  }
setIo(io) {
    this.io = io;
    console.log("[SessionManager] Socket.io instance injected successfully.");
  }
  /**
   * VALIDATE ACTION
   * @param {string} userId 
   * @param {string} fileId 
   * @param {string} action - 'READ' | 'EDIT' | 'DELETE' | 'SHARE' | 'CHECKPOINT'
   */
  async validateAction(userId, fileId, action) {
    // 1. Get the source of truth from DB
    const access = await this.getAccessMode(userId, fileId);
    
    if (!access) {
      return {
        allowed: false,
        reason: 'NO_ACCESS',
        message: 'Bhai, is file ka access nahi hai tumhare paas.',
      };
    }

    // 2. Permission Map (Based on your Schema Roles)
    const permissions = {
      ADMIN: ['READ', 'EDIT', 'DELETE', 'SHARE', 'CHECKPOINT'],
      EDITOR: ['READ', 'EDIT', 'CHECKPOINT'],
      VIEWER: ['READ'],
    };

    const allowed = permissions[access.mode]?.includes(action);

    if (!allowed) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_PERMISSIONS',
        message: `${access.mode} mode mein ${action} allowed nahi hai.`,
        currentMode: access.mode,
      };
    }

    // 3. Redis Session Sync
    // Taaki agar role change ho toh real-time reflection ho sake
    const sessionKey = `file_session:${fileId}`;
    const sessionData = await this.redis.hGet(sessionKey, userId);

    if (sessionData) {
      const participant = JSON.parse(sessionData);
      if (participant.accessMode !== access.mode) {
        await this.syncAccessMode(userId, fileId, access.mode);
      }
    }

    return {
      allowed: true,
      mode: access.mode,
    };
  }

  /**
   * GET ACCESS MODE
   * Checks Hierarchy: Project Owner > File Creator > Collaborator List
   */
  async getAccessMode(userId, fileId) {
    const file = await this.prisma.fileMeta.findUnique({
      where: { id: fileId },
      include: {
        project: true,
        collaboratorDetail: true,
      },
    });

    if (!file) return null;

    // A. Project Level Check (The Ultimate Boss)
    if (file.project.ownerId === userId) {
      return { mode: 'ADMIN', source: 'PROJECT_OWNER' };
    }

    // B. File Level Creator Check
    if (file.creatorId === userId) {
      return { mode: 'ADMIN', source: 'FILE_CREATOR' };
    }

    // C. CollaboratorDetail Table Check
    const collab = file.collaboratorDetail;
    if (collab) {
      if (collab.adminId === userId) {
        return { mode: 'ADMIN', source: 'COLLAB_ADMIN' };
      }
      if (collab.editors.includes(userId)) {
        return { mode: 'EDITOR', source: 'COLLAB_EDITOR' };
      }
      if (collab.viewers.includes(userId)) {
        return { mode: 'VIEWER', source: 'COLLAB_VIEWER' };
      }
    }

    // D. Global Access Check (User.accessibleProjectIds)
    // Agar project-level permission grant ki gayi hai
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { accessibleProjectIds: true }
    });

    if (user?.accessibleProjectIds.includes(file.projectId)) {
      // Default to VIEWER if specifically not in file collab list
      return { mode: 'VIEWER', source: 'PROJECT_ACCESS_LIST' };
    }

    return null;
  }

  async syncAccessMode(userId, fileId, newMode) {
    const key = `file_session:${fileId}`;
    const data = await this.redis.hGet(key, userId);
    
    if (data) {
      const participant = JSON.parse(data);
      participant.accessMode = newMode;
      participant.modeChangedAt = new Date().toISOString();

      await this.redis.hSet(key, userId, JSON.stringify(participant));
      
      // Notify the specific user via socket about the change
      this.io.to(`user:${userId}`).emit('PERMISSION_UPDATED', {
        fileId,
        newMode
      });
    }
  }
}