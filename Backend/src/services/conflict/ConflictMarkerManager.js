// src/services/conflict/ConflictMarkerManager.js (FIXED VERSION)

/**
 * ConflictMarkerManager - FIXED
 *
 * ✅ FIXES:
 * 1. Prevent duplicate markers for same conflict
 * 2. Skip already-marked lines
 * 3. Proper line:col to absolute index conversion
 * 4. Check if line already has marker before inserting
 */

import * as Y from "yjs";

class ConflictMarkerManager {
  constructor(yjsDocManager, rangeTracker) {
    this.yjsDocManager = yjsDocManager;
    this.rangeTracker = rangeTracker;
    this.markedConflicts = new Map(); // fileId → Set of conflictIds already marked
  }

  /**
   * FIXED: Check if conflict already has marker
   */
  _isConflictAlreadyMarked(fileId, conflictId) {
    if (!this.markedConflicts.has(fileId)) {
      this.markedConflicts.set(fileId, new Set());
    }

    const marked = this.markedConflicts.get(fileId);
    return marked.has(conflictId);
  }

  /**
   * Mark conflict as processed
   */
  _markConflictAsMarked(fileId, conflictId) {
    if (!this.markedConflicts.has(fileId)) {
      this.markedConflicts.set(fileId, new Set());
    }

    this.markedConflicts.get(fileId).add(conflictId);
  }

  /**
   * FIXED: Check if line already has marker
   */
  _lineHasMarker(text, lineNum) {
    const lines = text.split("\n");
    if (lineNum >= lines.length) return false;

    const lineContent = lines[lineNum];
    return (
      lineContent.includes("<<<<<< CONFLICT") || lineContent.includes(">>>>>>")
    );
  }

  /**
   * INSERT MARKER - WITH DUPLICATE PREVENTION
   */
  async insertMarker(fileId, conflict, userId) {
    try {
      // 1. Get the wrapper object from your manager
      const docWrapper = await this.yjsDocManager.getOrCreateDoc(fileId);

      // Validation as per your store logic
      if (!docWrapper || !docWrapper.ydoc || !docWrapper.ytext) {
        throw new Error(
          "Could not get Shadow Doc or required Yjs types from RAM",
        );
      }

      // Destructure based on your docData structure
      const { ydoc, ytext } = docWrapper;
      const { location, symbol, metadata, id: conflictId } = conflict;
      const fullText = ytext.toString();

      // ✅ PREVENTION #1: Check if already marked (Using your logic)
      if (this._isConflictAlreadyMarked(fileId, conflictId)) {
        console.log(
          `[MarkerManager] ⚠️ Conflict ${conflictId} already marked, skipping`,
        );
        return { success: false, reason: "already_marked" };
      }

      // ✅ PREVENTION #2: Check if line already has marker
      if (this._lineHasMarker(fullText, location.startLine)) {
        console.log(
          `[MarkerManager] ⚠️ Line ${location.startLine} already has marker, skipping`,
        );
        return { success: false, reason: "line_already_marked" };
      }

      // Build marker (COMPACT VERSION)
      const markerStart = `<<<<<< CONFLICT:${conflictId.slice(0, 8)}`;
      const markerDivider = `======`;
      const markerMessage = `// ${conflict.type}: '${symbol}' conflict`;
      const markerEnd = `>>>>>>>`;
      const fullMarker = `\n${markerStart}\n${markerDivider}\n${markerMessage}\n${markerEnd}\n`;

      // ✅ PROPER CONVERSION: line:col → absolute index
      // Using line start (col 0) for insertion
      const absoluteIndex = this._lineColToIndex(
        fullText,
        location.startLine,
        0,
      );

      console.log(
        `[MarkerManager] Index: ${absoluteIndex} | Length: ${fullText.length}`,
      );

      if (absoluteIndex < 0 || absoluteIndex > fullText.length) {
        throw new Error(
          `Invalid index: ${absoluteIndex} for text length ${fullText.length}`,
        );
      }

      // ════════════════════════════════════════════════════════════
      // 🔴 FIX: Using ydoc (The actual Y.Doc instance) for transaction
      // ════════════════════════════════════════════════════════════
      let deltaUpdate = null;

      ydoc.transact(() => {
        ytext.insert(absoluteIndex, fullMarker, {
          conflictId: conflictId,
          conflictType: conflict.type,
          symbol: symbol,
          isMarker: true,
          severity: conflict.severity,
          createdAt: Date.now(),
          createdBy: metadata?.createdBy || userId,
        });
      });

      // Encode state update for broadcasting
      deltaUpdate = Y.encodeStateAsUpdate(ydoc);
      // ════════════════════════════════════════════════════════════

      // ✅ MARK AS PROCESSED
      this._markConflictAsMarked(fileId, conflictId);

      // Track range for deletion/updates later
      if (this.rangeTracker) {
        this.rangeTracker.addRange(fileId, conflictId, {
          from: { line: location.startLine, ch: 0 },
          to: { line: location.startLine + 4, ch: 0 }, // Approx marker height
          markerLength: fullMarker.length,
          markerStart: absoluteIndex,
        });
      }

      console.log(
        `[MarkerManager] ✅ Marker inserted for conflict ${conflictId}`,
      );

      return {
        success: true,
        conflictId,
        delta: deltaUpdate,
        markerLength: fullMarker.length,
        markerStart: absoluteIndex,
      };
    } catch (err) {
      console.error("[MarkerManager] Insert marker error:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * REMOVE MARKER
   */
  async removeMarker(fileId, conflictId) {
    try {
      const doc = await this.yjsDocManager.getOrCreateDoc(fileId);
      if (!doc) throw new Error("Could not get Shadow Doc");

      const ytext = doc.getText("code");

      // Get marker range from tracker
      const range = this.rangeTracker.getRange(fileId, conflictId);
      if (!range) {
        console.warn(`[MarkerManager] No range found for ${conflictId}`);
        return { success: false, error: "Range not found" };
      }

      const content = ytext.toString();
      const { markerStart, markerLength } = range;

      console.log(
        `[MarkerManager] Removing marker for ${conflictId} at index ${markerStart}, length: ${markerLength}`,
      );

      let deltaUpdate = null;

      doc.transact(() => {
        if (markerStart >= 0 && markerStart + markerLength <= content.length) {
          ytext.delete(markerStart, markerLength);
          console.log(
            `[MarkerManager] ✅ Marker deleted for conflict ${conflictId}`,
          );
        } else {
          throw new Error(
            `Invalid range: start=${markerStart}, length=${markerLength}, contentLength=${content.length}`,
          );
        }

        deltaUpdate = Y.encodeStateAsUpdate(doc);
      });

      // Cleanup
      this.rangeTracker.removeRange(fileId, conflictId);

      // Remove from marked set
      if (this.markedConflicts.has(fileId)) {
        this.markedConflicts.get(fileId).delete(conflictId);
      }

      return {
        success: true,
        conflictId,
        delta: deltaUpdate,
      };
    } catch (err) {
      console.error("[MarkerManager] Remove marker error:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * FIXED: Proper line:col to absolute index conversion
   */
  _lineColToIndex(text, targetLine, targetCol) {
    const lines = text.split("\n");
    let index = 0;

    // Add all characters from lines before target line
    for (let i = 0; i < targetLine && i < lines.length; i++) {
      index += lines[i].length + 1; // +1 for \n
    }

    // Add column position in target line
    if (targetLine < lines.length) {
      index += Math.min(targetCol, lines[targetLine].length);
    }

    return index;
  }

  /**
   * Clear all markers for a file
   */
  async clearAllMarkers(fileId) {
    try {
      const doc = await this.yjsDocManager.getOrCreateDoc(fileId);
      if (!doc) return false;

      const ytext = doc.getText("code");
      const text = ytext.toString();

      // Find all markers
      const markerPattern = /\n?<<<<<< CONFLICT:[^\n]+\n=+\n[^\n]+\n>>>+\n?/g;
      let match;
      const matches = [];

      while ((match = markerPattern.exec(text)) !== null) {
        matches.push({
          start: match.index,
          length: match[0].length,
        });
      }

      // Delete in reverse order (so indices don't shift)
      doc.transact(() => {
        for (let i = matches.length - 1; i >= 0; i--) {
          ytext.delete(matches[i].start, matches[i].length);
        }
      });

      // Clear tracking
      this.markedConflicts.delete(fileId);
      this.rangeTracker.clearFile(fileId);

      console.log(
        `[MarkerManager] ✅ Cleared ${matches.length} markers from ${fileId}`,
      );

      return true;
    } catch (err) {
      console.error("[MarkerManager] Clear markers error:", err);
      return false;
    }
  }

  /**
   * Get active markers in document
   */
  async getActiveMarkers(fileId) {
    try {
      const doc = await this.yjsDocManager.getOrCreateDoc(fileId);
      if (!doc) return [];

      const ytext = doc.getText("code");
      const markers = [];

      for (let i = 0; i < ytext.length; i++) {
        const attrs = ytext.getAttributes(i);
        if (attrs?.isMarker && attrs?.conflictId) {
          markers.push({
            index: i,
            conflictId: attrs.conflictId,
            type: attrs.conflictType,
            symbol: attrs.symbol,
          });
        }
      }

      return markers;
    } catch (err) {
      console.error("[MarkerManager] Get markers error:", err);
      return [];
    }
  }
}

export default ConflictMarkerManager;
