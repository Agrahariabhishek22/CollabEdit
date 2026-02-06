// jobs/FlushScheduler.js

class FlushScheduler {
  constructor(yjsDocManager) {
    this.yjsDocManager = yjsDocManager;
    this.interval = null;
  }

  start() {
    // Run every 5 minutes
    this.interval = setInterval(async () => {
      await this.flushAll();
    }, 5 * 60 * 1000);

    console.log('[FlushScheduler] Started (5 min interval)');
  }

  async flushAll() {
    try {
      const fileIds = Array.from(this.yjsDocManager.activeDocs.keys());

      console.log(`[FlushScheduler] Flushing ${fileIds.length} active files`);

      for (const fileId of fileIds) {
        try {
          await this.yjsDocManager.flushToDisk(fileId);
        } catch (err) {
          console.error(`[FlushScheduler] Error flushing ${fileId}:`, err);
        }
      }

      console.log('[FlushScheduler] Flush complete');

    } catch (err) {
      console.error('[FlushScheduler] Error:', err);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('[FlushScheduler] Stopped');
    }
  }
}

export default FlushScheduler;