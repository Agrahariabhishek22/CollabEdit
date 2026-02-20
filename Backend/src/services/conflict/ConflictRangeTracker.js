// src/services/conflict/ConflictRangeTracker.js

/**
 * ConflictRangeTracker
 *
 * Tracks marker ranges in memory for each file.
 * Prevents nested markers and overlapping conflicts.
 *
 * USAGE:
 * tracker.addRange(conflictId, { from: {line, ch}, to: {line, ch} })
 * tracker.isOverlapping(from, to) → boolean
 * tracker.getRangesInArea(startLine, endLine) → ConflictObject[]
 * tracker.removeRange(conflictId)
 */
class ConflictRangeTracker {
  constructor() {
    // fileId → Map<conflictId, range>
    this.fileRanges = new Map();
  }

  /**
   * Add a range for a conflict
   */
  addRange(fileId, conflictId, range) {
    if (!this.fileRanges.has(fileId)) {
      this.fileRanges.set(fileId, new Map());
    }

    this.fileRanges.get(fileId).set(conflictId, range);
    console.log(`[RangeTracker] Added range for conflict ${conflictId} in ${fileId}`);
  }

  /**
   * Check if range overlaps with existing conflicts
   */
  isOverlapping(fileId, newRange) {
    const ranges = this.fileRanges.get(fileId);
    if (!ranges) return false;

    for (const [id, existingRange] of ranges.entries()) {
      if (this._rangesIntersect(newRange, existingRange)) {
        console.log(
          `[RangeTracker] New range overlaps with conflict ${id}`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Get all conflicts in a line range
   */
  getRangesInArea(fileId, startLine, endLine) {
    const ranges = this.fileRanges.get(fileId);
    if (!ranges) return [];

    const result = [];

    for (const [id, range] of ranges.entries()) {
      if (
        (range.from.line >= startLine && range.from.line <= endLine) ||
        (range.to.line >= startLine && range.to.line <= endLine) ||
        (range.from.line <= startLine && range.to.line >= endLine)
      ) {
        result.push({ conflictId: id, range });
      }
    }

    return result;
  }

  /**
   * Remove a range
   */
  removeRange(fileId, conflictId) {
    const ranges = this.fileRanges.get(fileId);
    if (!ranges) return false;

    const removed = ranges.delete(conflictId);

    if (ranges.size === 0) {
      this.fileRanges.delete(fileId);
    }

    if (removed) {
      console.log(`[RangeTracker] Removed range for conflict ${conflictId}`);
    }

    return removed;
  }

  /**
   * Clear all ranges for file
   */
  clearFile(fileId) {
    this.fileRanges.delete(fileId);
    console.log(`[RangeTracker] Cleared all ranges for ${fileId}`);
  }

  /**
   * Helper: Check if two ranges intersect
   */
  _rangesIntersect(range1, range2) {
    // Convert to line:ch format
    const r1Start = range1.from.line * 10000 + range1.from.ch;
    const r1End = range1.to.line * 10000 + range1.to.ch;
    const r2Start = range2.from.line * 10000 + range2.from.ch;
    const r2End = range2.to.line * 10000 + range2.to.ch;

    return !(r1End < r2Start || r2End < r1Start);
  }

  /**
   * Get all ranges for file
   */
  getAllRanges(fileId) {
    const ranges = this.fileRanges.get(fileId);
    if (!ranges) return {};

    const result = {};
    for (const [id, range] of ranges.entries()) {
      result[id] = range;
    }
    return result;
  }
}

export default ConflictRangeTracker;