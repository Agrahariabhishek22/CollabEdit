// services/permissions/PermissionValidator.js

export default class PermissionValidator {
  constructor(prisma, redis, sessionManager, io) {
    this.prisma = prisma;
    this.redis = redis;
    this.sessionManager = sessionManager;
    this.io = io;
  }

  // ═══════════════════════════════════════════════════════════
  // VALIDATE ACTION (Called on EVERY socket event)
  // ═══════════════════════════════════════════════════════════

  async validateAction(userId, fileId, action) {
    /**
     * Actions:
     * - 'READ'   → All modes allowed
     * - 'EDIT'   → ADMIN, EDITOR only
     * - 'DELETE' → ADMIN only
     * - 'SHARE'  → ADMIN only
     */

    // Step 1: Get current access mode from DB (source of truth)
    const access = await this.getAccessMode(userId, fileId);
    
    if (!access) {
      return {
        allowed: false,
        reason: 'NO_ACCESS',
        message: 'You do not have access to this file',
      };
    }

    // Step 2: Check if action is allowed
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
        message: `${access.mode} cannot perform ${action}`,
        currentMode: access.mode,
      };
    }

    // Step 3: Validate against Redis session
    const sessionAccess = await this.redis.hget(
      `file_session:${fileId}`,
      userId
    );

    if (sessionAccess) {
      const { accessMode: cachedMode } = JSON.parse(sessionAccess);
      
      // DB and cache mismatch = Role changed mid-session
      if (cachedMode !== access.mode) {
        await this.syncAccessMode(userId, fileId, access.mode);
      }
    }

    return {
      allowed: true,
      mode: access.mode,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // GET ACCESS MODE (DB Query)
  // ═══════════════════════════════════════════════════════════

  async getAccessMode(userId, fileId) {
    const file = await this.prisma.fileMeta.findUnique({
      where: { id: fileId },
      include: {
        collaboratorDetail: true,
        project: true,
      },
    });

    if (!file) return null;

    // Check project owner
    if (file.project.ownerId === userId) {
      return { mode: 'ADMIN', source: 'PROJECT_OWNER' };
    }

    // Check file creator
    if (file.creatorId === userId) {
      return { mode: 'ADMIN', source: 'FILE_CREATOR' };
    }

    // Check CollaboratorDetail
    const collab = file.collaboratorDetail;
    
    if (collab.adminId === userId) {
      return { mode: 'ADMIN', source: 'ADMIN_LIST' };
    }

    if (collab.editors.includes(userId)) {
      return { mode: 'EDITOR', source: 'EDITOR_LIST' };
    }

    if (collab.viewers.includes(userId)) {
      return { mode: 'VIEWER', source: 'VIEWER_LIST' };
    }

    return null; // No access
  }

  // ═══════════════════════════════════════════════════════════
  // SYNC ACCESS MODE (Update Redis cache)
  // ═══════════════════════════════════════════════════════════

  async syncAccessMode(userId, fileId, newMode) {
    const data = await this.redis.hget(`file_session:${fileId}`, userId);
    if (data) {
      const participant = JSON.parse(data);
      participant.accessMode = newMode;
      participant.modeChangedAt = Date.now();

      await this.redis.hset(
        `file_session:${fileId}`,
        userId,
        JSON.stringify(participant)
      );
    }
  }
}

