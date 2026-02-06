// jobs/LSPHealthCheck.js

class LSPHealthCheck {
  constructor(lspManager) {
    this.lspManager = lspManager;
    this.interval = null;
  }

  start() {
    // Run every 3 minutes
    this.interval = setInterval(async () => {
      await this.check();
    }, 3 * 60 * 1000);

    console.log('[LSPHealthCheck] Started (3 min interval)');
  }

  async check() {
    try {
      // Cleanup idle LSP processes
      await this.lspManager.cleanupIdle(5 * 60 * 1000); // 5 min threshold

      // Check for zombie processes
      for (const [fileId, proc] of this.lspManager.processes.entries()) {
        try {
          // Send ping
          process.kill(proc.pid, 0); // Signal 0 checks if process exists
        } catch (err) {
          // Process is dead, remove from map
          console.log(`[LSPHealthCheck] Removing dead process for ${fileId}`);
          this.lspManager.processes.delete(fileId);
        }
      }

    } catch (err) {
      console.error('[LSPHealthCheck] Error:', err);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('[LSPHealthCheck] Stopped');
    }
  }
}

export default LSPHealthCheck;