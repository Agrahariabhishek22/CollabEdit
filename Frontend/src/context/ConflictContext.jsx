/**
 * ConflictContext.jsx
 *
 * Manages conflict state and socket listeners for collaborative conflict resolution
 * Separate from EditorContext to keep concerns isolated
 *
 * Structure: { fileId: [conflicts] }
 */

import React, { createContext, useCallback, useEffect, useState } from "react";

export const ConflictContext = createContext(null);

export const ConflictProvider = ({ children, socket }) => {
  // ════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ════════════════════════════════════════════════════════════════════

  /**
   * conflicts: {
   *   "fileId1": [
   *     {
   *       id: "uuid",
   *       type: "duplicate-declaration",
   *       severity: "blocking",
   *       symbol: "myVar",
   *       location: { startLine: 5, endLine: 5, ... },
   *       suggestedFix: { type: "rename", suggestions: ["myVar1"] },
   *       metadata: { createdAt, createdBy, status },
   *     }
   *   ]
   * }
   */
  const [conflicts, setConflicts] = useState({});

  /**
   * Track which conflict modal is currently open
   * { fileId: "uuid-of-conflict" } or null
   */
  const [activeConflict, setActiveConflict] = useState(null);

  // ════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Add or update conflicts for a file
   */
  const addConflicts = useCallback((fileId, newConflicts) => {
    if (!fileId || !newConflicts) return;

    setConflicts((prev) => {
      const existing = prev[fileId] || [];

      // Merge: Keep existing, add new ones (avoid duplicates by ID)
      const existingIds = new Set(existing.map((c) => c.id));
      const merged = [
        ...existing,
        ...newConflicts.filter((c) => !existingIds.has(c.id)),
      ];

      return {
        ...prev,
        [fileId]: merged,
      };
    });
  }, []);

  /**
   * Remove specific conflict by ID
   */
  const removeConflict = useCallback(
    (fileId, conflictId) => {
      setConflicts((prev) => ({
        ...prev,
        [fileId]: (prev[fileId] || []).filter((c) => c.id !== conflictId),
      }));

      // Close modal if this conflict was active
      if (activeConflict?.id === conflictId) {
        setActiveConflict(null);
      }
    },
    [activeConflict],
  );

  /**
   * Clear all conflicts for a file
   */
  const clearConflicts = useCallback((fileId) => {
    setConflicts((prev) => ({
      ...prev,
      [fileId]: [],
    }));
    setActiveConflict(null);
  }, []);

  /**
   * Get conflicts for a specific file
   */
  const getConflicts = useCallback(
    (fileId) => conflicts[fileId] || [],
    [conflicts],
  );

  /**
   * Check if a line has any conflicts
   */
  const getConflictsByLine = useCallback(
    (fileId, lineNumber) => {
      return getConflicts(fileId).filter(
        (c) =>
          lineNumber >= c.location.startLine &&
          lineNumber <= c.location.endLine,
      );
    },
    [getConflicts],
  );

  // ════════════════════════════════════════════════════════════════════
  // SOCKET EVENT LISTENERS
  // ════════════════════════════════════════════════════════════════════

  /**
   * Listen for conflict:detected events from backend
   * Fired when ConflictDetector finds issues in code
   * Backend sends ONE conflict at a time (not an array)
   */
  useEffect(() => {
    if (!socket) return;

    const handleConflictDetected = (conflictData) => {
      const {
        fileId,
        conflictId,
        type,
        severity,
        symbol,
        location,
        suggestedFix,
        relatedSymbols,
        message,
      } = conflictData;

      console.log(
        `[ConflictContext] Detected conflict: ${conflictId} in ${fileId} - ${type}`,
      );

      // Convert backend format to internal format
      const formattedConflict = {
        id: conflictId, // ✅ Map conflictId → id for consistency with frontend
        type,
        severity,
        symbol,
        location,
        suggestedFix,
        relatedSymbols: relatedSymbols || [],
        message,
        metadata: {
          createdAt: Date.now(),
          status: "unresolved",
        },
      };

      // Add single conflict to state (grouped by fileId)
      addConflicts(fileId, [formattedConflict]);

      // Auto-open modal for first blocking conflict if none is open
      if (!activeConflict && severity === "blocking") {
        setActiveConflict({ ...formattedConflict, fileId });
      }
    };

    socket.on("conflict:detected", handleConflictDetected);

    return () => {
      socket.off("conflict:detected", handleConflictDetected);
    };
  }, [socket, addConflicts, activeConflict]);

  /**
   * Listen for conflict:resolved events from backend
   * Fired when another user or backend resolves a conflict
   */
  useEffect(() => {
    if (!socket) return;

    const handleConflictResolved = ({ fileId, conflictId }) => {
      console.log(
        `[ConflictContext] Conflict resolved: ${conflictId} in ${fileId}`,
      );

      removeConflict(fileId, conflictId);
    };

    socket.on("conflict:resolved", handleConflictResolved);

    return () => {
      socket.off("conflict:resolved", handleConflictResolved);
    };
  }, [socket, removeConflict]);

  /**
   * Listen for conflict:dismissed events from backend
   * Fired when user dismisses a conflict warning
   */
  useEffect(() => {
    if (!socket) return;

    const handleConflictDismissed = ({ fileId, conflictId }) => {
      console.log(
        `[ConflictContext] Conflict dismissed: ${conflictId} in ${fileId}`,
      );

      removeConflict(fileId, conflictId);
    };

    socket.on("conflict:dismissed", handleConflictDismissed);

    return () => {
      socket.off("conflict:dismissed", handleConflictDismissed);
    };
  }, [socket, removeConflict]);

  // ════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════

  const value = {
    // State
    conflicts,
    activeConflict,

    // Setters
    setActiveConflict,

    // Operations
    addConflicts,
    removeConflict,
    clearConflicts,
    getConflicts,
    getConflictsByLine,

    // Helpers
    hasConflicts: (fileId) => getConflicts(fileId).length > 0,
    conflictCount: (fileId) => getConflicts(fileId).length,
  };

  return (
    <ConflictContext.Provider value={value}>
      {children}
    </ConflictContext.Provider>
  );
};
