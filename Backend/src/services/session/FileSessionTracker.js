// services/session/FileSessionTracker.js

export default class FileSessionTracker {
  constructor(redis, sessionManager) {
    this.redis = redis;
    this.sessionManager = sessionManager;
  }

  /**
   * Check if file has ANY active users
   */
  async isFileActive(fileId) {
    const count = await this.redis.hlen(`file_session:${fileId}`);
    return count > 0;
  }

  /**
   * Get count of active users per access mode
   */
  async getAccessModeStats(fileId) {
    const participants = await this.sessionManager.getFileParticipants(fileId);
    
    const stats = {
      ADMIN: 0,
      EDITOR: 0,
      VIEWER: 0,
      total: 0,
    };

    for (const user of Object.values(participants)) {
      stats[user.accessMode]++;
      stats.total++;
    }

    return stats;
  }

  /**
   * Check if user has EDITOR or ADMIN access
   */
  async canUserEdit(fileId, userId) {
    const data = await this.redis.hget(`file_session:${fileId}`, userId);
    if (!data) return false;

    const { accessMode } = JSON.parse(data);
    return accessMode === 'ADMIN' || accessMode === 'EDITOR';
  }

  /**
   * Detect idle users (no activity in 5 min)
   */
  async getIdleUsers(fileId, idleThresholdMs = 5 * 60 * 1000) {
    const participants = await this.sessionManager.getFileParticipants(fileId);
    const now = Date.now();
    const idle = [];

    for (const [userId, user] of Object.entries(participants)) {
      const lastActivity = user.lastActivity || user.joinedAt;
      if (now - lastActivity > idleThresholdMs) {
        idle.push(userId);
      }
    }

    return idle;
  }
}

