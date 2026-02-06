// jobs/SessionCleanup.js

class SessionCleanup {
  constructor(sessionManager, fileSessionTracker, yjsDocManager) {
    this.sessionManager = sessionManager;
    this.fileSessionTracker = fileSessionTracker;
    this.yjsDocManager = yjsDocManager;
    this.interval = null;
  }

  start() {
    // Run every 2 minutes
    this.interval = setInterval(async () => {
      await this.cleanup();
    }, 2 * 60 * 1000);

    console.log('[SessionCleanup] Started (2 min interval)');
  }

  async cleanup() {
    try {
      const fileIds = Array.from(this.yjsDocManager.activeDocs.keys());

      for (const fileId of fileIds) {
        // Check if file has active users
        const isActive = await this.fileSessionTracker.isFileActive(fileId);

        if (!isActive) {
          // No users, schedule cleanup
          console.log(`[SessionCleanup] Scheduling cleanup for ${fileId}`);
          
          setTimeout(async () => {
            const stillInactive = !(await this.fileSessionTracker.isFileActive(fileId));
            
            if (stillInactive) {
              await this.yjsDocManager.cleanup(fileId);
            }
          }, 5 * 60 * 1000); // 5 min delay
        }
      }

    } catch (err) {
      console.error('[SessionCleanup] Error:', err);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('[SessionCleanup] Stopped');
    }
  }
}

export default SessionCleanup;