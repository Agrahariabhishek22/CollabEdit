// src/services/yjs/YjsConflictResolver.js

import * as Y from "yjs";

/**
 * YjsConflictResolver
 * 
 * PURPOSE: Handle CRDT merge conflicts and edge cases
 * 
 * NOTE: Yjs (CRDT) automatically resolves most conflicts.
 * This service handles edge cases and provides conflict metadata.
 * 
 * RESPONSIBILITIES:
 * 1. Detect semantic conflicts (LSP-based)
 * 2. Generate conflict markers (Git-style)
 * 3. Merge strategies for special cases
 * 4. Conflict logging for analysis
 * 
 * WORKFLOW:
 * - Yjs handles text-level conflicts automatically
 * - This resolver detects SEMANTIC conflicts (via LSP)
 * - Inserts markers if needed: <<<<<<< ======= >>>>>>>
 */

class YjsConflictResolver {
  constructor(redis) {
    this.redis = redis;
  }

  // ═══════════════════════════════════════════════════════════
  // DETECT CONCURRENT EDITS (For logging/analytics)
  // ═══════════════════════════════════════════════════════════

  /**
   * Detect if two users edited same region simultaneously
   * Used for conflict analytics, not resolution (Yjs handles that)
   * 
   * @param {Y.Doc} ydoc - Yjs document
   * @param {Object} update1 - First update metadata
   * @param {Object} update2 - Second update metadata
   */
  detectConcurrentEdits(ydoc, update1, update2) {
    try {
      // Get state vectors
      const sv1 = Y.encodeStateVector(ydoc);
      const sv2 = Y.encodeStateVector(ydoc);

      // Check if updates overlap
      const overlap = this.checkOverlap(update1, update2);

      if (overlap) {
        console.warn(`[YjsConflictResolver] Concurrent edits detected:`, {
          user1: update1.userId,
          user2: update2.userId,
          range: overlap,
        });

        // Log to Redis for analytics
        this.logConflict({
          type: 'CONCURRENT_EDIT',
          users: [update1.userId, update2.userId],
          timestamp: Date.now(),
          overlap,
        });
      }

      return overlap;

    } catch (err) {
      console.error(`[YjsConflictResolver] Error detecting concurrent edits:`, err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK OVERLAP (Helper function)
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if two edits overlap
   */
  checkOverlap(update1, update2) {
    // Extract positions (if available in metadata)
    const range1 = update1.range || { start: 0, end: 0 };
    const range2 = update2.range || { start: 0, end: 0 };

    // Check for overlap
    const overlaps = !(
      range1.end < range2.start || range2.end < range1.start
    );

    if (overlaps) {
      return {
        start: Math.max(range1.start, range2.start),
        end: Math.min(range1.end, range2.end),
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // INSERT CONFLICT MARKERS (Git-style)
  // ═══════════════════════════════════════════════════════════

  /**
   * Insert Git-style conflict markers into text
   * Called when LSP detects semantic conflict
   * 
   * @param {Y.Text} ytext - Yjs text object
   * @param {number} position - Where to insert markers
   * @param {string} userAVersion - User A's version
   * @param {string} userBVersion - User B's version
   * @param {string} userAName - User A's name
   * @param {string} userBName - User B's name
   */
  insertConflictMarkers(ytext, position, userAVersion, userBVersion, userAName, userBName) {
    try {
      const marker = `
<<<<<<< ${userAName}'s changes
${userAVersion}
=======
${userBVersion}
>>>>>>> ${userBName}'s changes
`;

      // Insert at conflict position
      ytext.insert(position, marker);

      console.log(`[YjsConflictResolver] Inserted conflict markers at position ${position}`);

      return { success: true, position, length: marker.length };

    } catch (err) {
      console.error(`[YjsConflictResolver] Error inserting conflict markers:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // REMOVE CONFLICT MARKERS (After resolution)
  // ═══════════════════════════════════════════════════════════

  /**
   * Remove conflict markers after user resolves
   * 
   * @param {Y.Text} ytext - Yjs text object
   * @param {number} start - Start position of markers
   * @param {number} length - Length of markers
   */
  removeConflictMarkers(ytext, start, length) {
    try {
      ytext.delete(start, length);
      
      console.log(`[YjsConflictResolver] Removed conflict markers at ${start}`);

      return { success: true };

    } catch (err) {
      console.error(`[YjsConflictResolver] Error removing markers:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LOG CONFLICT (To Redis for analytics)
  // ═══════════════════════════════════════════════════════════

  /**
   * Log conflict to Redis for post-mortem analysis
   */
  async logConflict(conflictData) {
    try {
      const key = `conflict_log:${Date.now()}`;
      
      await this.redis.setex(
        key,
        86400, // Keep for 24 hours
        JSON.stringify(conflictData)
      );

      console.log(`[YjsConflictResolver] Logged conflict: ${key}`);

    } catch (err) {
      console.error(`[YjsConflictResolver] Error logging conflict:`, err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GET CONFLICT STATS (For analytics dashboard)
  // ═══════════════════════════════════════════════════════════

  /**
   * Get conflict statistics from Redis logs
   */
  async getConflictStats(fileId, timeRange = 86400) {
    try {
      // Scan for conflict logs
      const keys = await this.redis.keys(`conflict_log:*`);
      
      const conflicts = [];
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          conflicts.push(JSON.parse(data));
        }
      }

      // Filter by time range
      const cutoff = Date.now() - (timeRange * 1000);
      const recent = conflicts.filter(c => c.timestamp > cutoff);

      return {
        total: recent.length,
        byType: this.groupByType(recent),
        byUser: this.groupByUser(recent),
      };

    } catch (err) {
      console.error(`[YjsConflictResolver] Error getting stats:`, err);
      return { total: 0, byType: {}, byUser: {} };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════

  groupByType(conflicts) {
    return conflicts.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});
  }

  groupByUser(conflicts) {
    return conflicts.reduce((acc, c) => {
      c.users.forEach(userId => {
        acc[userId] = (acc[userId] || 0) + 1;
      });
      return acc;
    }, {});
  }
}

export default YjsConflictResolver;