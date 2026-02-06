// src/services/lsp/LSPPool.js

/**
 * LSPPool
 * 
 * PURPOSE: Manage pool of LSP processes to prevent resource exhaustion
 * 
 * PROBLEM: Spawning 1 LSP per file = 100 files = 100 processes = 💥
 * SOLUTION: Pool of reusable LSP processes per language
 * 
 * STRATEGY:
 * - Max N processes per language (e.g., 3 Python LSPs max)
 * - Assign process to file based on availability
 * - Reuse idle processes
 * - Kill excess processes when idle
 * 
 * WORKFLOW:
 * 1. File opens → Request LSP from pool
 * 2. Pool assigns least-busy process
 * 3. File closes → Process becomes available
 * 4. Idle process (5 min) → Kill and remove from pool
 */

class LSPPool {
  constructor(maxProcessesPerLanguage = 3) {
    this.maxProcessesPerLanguage = maxProcessesPerLanguage;
    
    // Pool structure:
    // {
    //   'python': [
    //     { process, assignedFiles: Set(['file1', 'file2']), lastActivity: timestamp },
    //     { process, assignedFiles: Set(['file3']), lastActivity: timestamp }
    //   ],
    //   'javascript': [...]
    // }
    this.pools = {};
  }

  // ═══════════════════════════════════════════════════════════
  // GET OR CREATE PROCESS FOR FILE
  // ═══════════════════════════════════════════════════════════

  /**
   * Get available LSP process for a file
   * Creates new process if pool not full
   * 
   * @param {string} language - Language key (e.g., 'python')
   * @param {string} fileId - File ID
   * @param {Function} spawnFn - Function to spawn new process
   * @returns {Object} - Process data
   */
  async getProcess(language, fileId, spawnFn) {
    // Initialize pool for language if doesn't exist
    if (!this.pools[language]) {
      this.pools[language] = [];
    }

    const pool = this.pools[language];

    // Find least-busy process (fewest assigned files)
    let selectedProc = null;
    let minFiles = Infinity;

    for (const proc of pool) {
      const fileCount = proc.assignedFiles.size;
      if (fileCount < minFiles) {
        minFiles = fileCount;
        selectedProc = proc;
      }
    }

    // If pool is full and all processes are busy, use least-busy
    if (selectedProc && selectedProc.assignedFiles.size < 10) {
      selectedProc.assignedFiles.add(fileId);
      selectedProc.lastActivity = Date.now();
      
      console.log(`[LSPPool] Assigned ${language} process to ${fileId} (${selectedProc.assignedFiles.size} files)`);
      
      return selectedProc;
    }

    // If pool not full, spawn new process
    if (pool.length < this.maxProcessesPerLanguage) {
      const newProcess = await spawnFn();
      
      const procData = {
        process: newProcess,
        assignedFiles: new Set([fileId]),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        language,
      };

      pool.push(procData);

      console.log(`[LSPPool] Spawned new ${language} process (${pool.length}/${this.maxProcessesPerLanguage})`);

      return procData;
    }

    // Pool full and all busy, use least-busy anyway
    if (selectedProc) {
      selectedProc.assignedFiles.add(fileId);
      selectedProc.lastActivity = Date.now();
      
      console.warn(`[LSPPool] Pool full for ${language}, sharing process with ${selectedProc.assignedFiles.size} files`);
      
      return selectedProc;
    }

    throw new Error(`[LSPPool] No available process for ${language}`);
  }

  // ═══════════════════════════════════════════════════════════
  // RELEASE FILE FROM PROCESS
  // ═══════════════════════════════════════════════════════════

  /**
   * Remove file from process (when file closes)
   * 
   * @param {string} language - Language key
   * @param {string} fileId - File ID
   */
  releaseFile(language, fileId) {
    const pool = this.pools[language];
    if (!pool) return;

    for (const proc of pool) {
      if (proc.assignedFiles.has(fileId)) {
        proc.assignedFiles.delete(fileId);
        proc.lastActivity = Date.now();
        
        console.log(`[LSPPool] Released ${fileId} from ${language} process (${proc.assignedFiles.size} remaining)`);
        
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP IDLE PROCESSES
  // ═══════════════════════════════════════════════════════════

  /**
   * Kill idle processes with no assigned files
   * Called by LSPHealthCheck job
   * 
   * @param {number} idleThresholdMs - Idle time threshold (default 5 min)
   */
  cleanupIdle(idleThresholdMs = 5 * 60 * 1000) {
    const now = Date.now();

    for (const [language, pool] of Object.entries(this.pools)) {
      // Filter out idle processes
      const activeProcesses = pool.filter(proc => {
        const isIdle = proc.assignedFiles.size === 0 && (now - proc.lastActivity) > idleThresholdMs;

        if (isIdle) {
          // Kill process
          try {
            proc.process.kill();
            console.log(`[LSPPool] Killed idle ${language} process (${proc.assignedFiles.size} files, idle ${Math.round((now - proc.lastActivity) / 1000)}s)`);
          } catch (err) {
            console.error(`[LSPPool] Error killing process:`, err);
          }
          return false; // Remove from pool
        }

        return true; // Keep in pool
      });

      this.pools[language] = activeProcesses;

      if (activeProcesses.length < pool.length) {
        console.log(`[LSPPool] ${language} pool: ${pool.length} → ${activeProcesses.length} processes`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GET POOL STATS (For monitoring)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get pool statistics
   * 
   * @returns {Object} - Pool stats by language
   */
  getStats() {
    const stats = {};

    for (const [language, pool] of Object.entries(this.pools)) {
      stats[language] = {
        processCount: pool.length,
        totalFiles: pool.reduce((sum, proc) => sum + proc.assignedFiles.size, 0),
        processes: pool.map(proc => ({
          assignedFiles: proc.assignedFiles.size,
          idleTime: Date.now() - proc.lastActivity,
        })),
      };
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════
  // KILL ALL PROCESSES (On shutdown)
  // ═══════════════════════════════════════════════════════════

  /**
   * Kill all LSP processes
   * Called on server shutdown
   */
  killAll() {
    for (const [language, pool] of Object.entries(this.pools)) {
      for (const proc of pool) {
        try {
          proc.process.kill();
          console.log(`[LSPPool] Killed ${language} process`);
        } catch (err) {
          console.error(`[LSPPool] Error killing process:`, err);
        }
      }
    }

    this.pools = {};
    console.log(`[LSPPool] All processes killed`);
  }
}

export default LSPPool;