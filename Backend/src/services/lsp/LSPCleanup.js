// src/services/lsp/LSPCleanup.js

/**
 * LSPCleanup
 * 
 * PURPOSE: Monitor and cleanup idle LSP processes
 * 
 * RESPONSIBILITIES:
 * 1. Track LSP process activity
 * 2. Kill processes idle > 5 minutes
 * 3. Remove zombie processes
 * 4. Free up RAM
 * 
 * WORKFLOW:
 * - Background job runs every 3 minutes
 * - Checks last activity timestamp
 * - Kills idle processes
 * - Removes from LSPManager/LSPPool
 */

class LSPCleanup {
  constructor(lspManager, lspPool) {
    this.lspManager = lspManager;
    this.lspPool = lspPool;
    
    // Cleanup thresholds
    this.idleThreshold = 5 * 60 * 1000; // 5 minutes
    this.zombieCheckInterval = 3 * 60 * 1000; // 3 minutes
  }

  // ═══════════════════════════════════════════════════════════
  // RUN CLEANUP (Main cleanup logic)
  // ═══════════════════════════════════════════════════════════

  /**
   * Run full cleanup cycle
   * Called by LSPHealthCheck background job
   */
  async run() {
    console.log(`[LSPCleanup] Running cleanup cycle...`);

    const stats = {
      idle: 0,
      zombies: 0,
      errors: 0,
    };

    try {
      // Step 1: Cleanup idle processes in pool
      stats.idle = await this.cleanupIdleProcesses();

      // Step 2: Check for zombie processes
      stats.zombies = await this.cleanupZombieProcesses();

      console.log(`[LSPCleanup] Cleanup complete:`, stats);

    } catch (err) {
      console.error(`[LSPCleanup] Cleanup error:`, err);
      stats.errors++;
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP IDLE PROCESSES
  // ═══════════════════════════════════════════════════════════

  /**
   * Kill processes that have been idle > threshold
   */
  async cleanupIdleProcesses() {
    let killedCount = 0;

    try {
      // Use LSPPool's cleanup method
      if (this.lspPool) {
        const beforeStats = this.lspPool.getStats();
        
        this.lspPool.cleanupIdle(this.idleThreshold);
        
        const afterStats = this.lspPool.getStats();

        // Calculate how many were killed
        for (const lang in beforeStats) {
          const before = beforeStats[lang].processCount;
          const after = afterStats[lang]?.processCount || 0;
          killedCount += (before - after);
        }
      }

      // Also cleanup LSPManager's direct processes
      if (this.lspManager) {
        await this.lspManager.cleanupIdle(this.idleThreshold);
      }

      if (killedCount > 0) {
        console.log(`[LSPCleanup] Killed ${killedCount} idle processes`);
      }

    } catch (err) {
      console.error(`[LSPCleanup] Error cleaning idle processes:`, err);
    }

    return killedCount;
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP ZOMBIE PROCESSES
  // ═══════════════════════════════════════════════════════════

  /**
   * Detect and remove zombie processes (dead but still in map)
   */
  async cleanupZombieProcesses() {
    let zombieCount = 0;

    try {
      // Check processes in LSPManager
      if (this.lspManager && this.lspManager.processes) {
        for (const [fileId, proc] of this.lspManager.processes.entries()) {
          try {
            // Send signal 0 to check if process exists
            // Throws error if process is dead
            process.kill(proc.pid, 0);
          } catch (err) {
            // Process is dead, remove from map
            console.log(`[LSPCleanup] Removing zombie process for ${fileId} (PID ${proc.pid})`);
            this.lspManager.processes.delete(fileId);
            zombieCount++;
          }
        }
      }

      if (zombieCount > 0) {
        console.log(`[LSPCleanup] Removed ${zombieCount} zombie processes`);
      }

    } catch (err) {
      console.error(`[LSPCleanup] Error cleaning zombies:`, err);
    }

    return zombieCount;
  }

  // ═══════════════════════════════════════════════════════════
  // GET CLEANUP STATS (For monitoring dashboard)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get statistics about cleanable processes
   */
  getCleanupStats() {
    const stats = {
      totalProcesses: 0,
      idleProcesses: 0,
      activeProcesses: 0,
      idleThreshold: this.idleThreshold,
    };

    try {
      if (this.lspPool) {
        const poolStats = this.lspPool.getStats();
        
        for (const langStats of Object.values(poolStats)) {
          stats.totalProcesses += langStats.processCount;
          
          for (const proc of langStats.processes) {
            if (proc.idleTime > this.idleThreshold) {
              stats.idleProcesses++;
            } else {
              stats.activeProcesses++;
            }
          }
        }
      }

    } catch (err) {
      console.error(`[LSPCleanup] Error getting stats:`, err);
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════
  // FORCE CLEANUP (Emergency cleanup)
  // ═══════════════════════════════════════════════════════════

  /**
   * Force kill all LSP processes
   * Used in emergency situations (e.g., server shutdown)
   */
  forceCleanupAll() {
    console.warn(`[LSPCleanup] Force cleanup initiated`);

    let killedCount = 0;

    try {
      // Kill all in pool
      if (this.lspPool) {
        this.lspPool.killAll();
        killedCount += Object.values(this.lspPool.pools).reduce((sum, pool) => sum + pool.length, 0);
      }

      // Kill all in manager
      if (this.lspManager && this.lspManager.processes) {
        for (const [fileId, proc] of this.lspManager.processes.entries()) {
          try {
            proc.process.kill();
            killedCount++;
          } catch (err) {
            console.error(`[LSPCleanup] Error killing ${fileId}:`, err);
          }
        }
        this.lspManager.processes.clear();
      }

      console.log(`[LSPCleanup] Force cleanup complete: ${killedCount} processes killed`);

    } catch (err) {
      console.error(`[LSPCleanup] Force cleanup error:`, err);
    }

    return killedCount;
  }
}

export default LSPCleanup;