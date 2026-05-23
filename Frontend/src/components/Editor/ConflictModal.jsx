/**
 * components/Editor/ConflictModal.jsx
 * 
 * Modal dialog for conflict resolution
 * Shows conflict details and provides resolution options
 * 
 * Emits socket events:
 * - conflict:resolve  (when user selects resolution)
 * - conflict:dismiss  (when user closes without resolving)
 */

import React, { useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import { getConflictConfig, RESOLUTION_TYPES } from "../../utils/conflictTypes";

const ConflictModal = ({ conflict, fileId, onClose }) => {
  const { socket } = useSocket();
  const [resolving, setResolving] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState(null);

  if (!conflict) return null;

  const config = getConflictConfig(conflict.type);

  // ════════════════════════════════════════════════════════════════════
  // RESOLUTION HANDLERS
  // ════════════════════════════════════════════════════════════════════

  const handleResolve = async (resolutionType) => {
    if (!socket || resolving) return;

    setResolving(true);
    setSelectedResolution(resolutionType);

    try {
      console.log(
        `[ConflictModal] Resolving conflict ${conflict.id} with ${resolutionType}`,
      );

      // Prepare data object
      let data = {};
      
      if (resolutionType === RESOLUTION_TYPES.RENAME) {
        const newName = prompt(`Rename "${conflict.symbol}" to:`, conflict.symbol);
        if (!newName) {
          setResolving(false);
          setSelectedResolution(null);
          return;
        }
        data.newName = newName;
      }

      // Emit to backend with correct structure
      socket.emit("conflict:resolve", {
        fileId,
        conflictId: conflict.id, // ✅ Use conflict.id (mapped from conflictId)
        resolution: resolutionType,
        data, // ✅ Include data object with resolution-specific params
      });

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error("[ConflictModal] Resolution error:", err);
    } finally {
      setResolving(false);
      setSelectedResolution(null);
    }
  };

  const handleDismiss = () => {
    if (!socket) return;

    console.log(`[ConflictModal] Dismissing conflict ${conflict.id}`);

    // Emit dismiss with correct structure
    socket.emit("conflict:dismiss", {
      fileId,
      conflictId: conflict.id,
    });

    onClose();
  };

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg rounded-lg shadow-2xl ${config.bgColor} border border-gray-700 p-6`}>
        {/* HEADER */}
        <div className="flex items-start gap-4 mb-4">
          <span className="text-3xl">{config.icon}</span>
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${config.textColor}`}>
              {config.label}
            </h2>
            <p className="text-gray-400 text-sm mt-1">{config.description}</p>
          </div>
        </div>

        {/* DETAILS */}
        <div className="bg-slate-900/50 rounded p-3 mb-4 border border-slate-800">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Symbol:</span>
              <p className="text-white font-mono">{conflict.symbol}</p>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <p className="text-white font-mono">{conflict.type}</p>
            </div>
            <div>
              <span className="text-gray-500">Location:</span>
              <p className="text-white font-mono">
                Line {conflict.location.startLine + 1}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Severity:</span>
              <p className={conflict.severity === "blocking" ? "text-red-400" : "text-yellow-400"}>
                {conflict.severity.toUpperCase()}
              </p>
            </div>
          </div>

          {/* RELATED SYMBOLS */}
          {conflict.relatedSymbols && conflict.relatedSymbols.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <span className="text-gray-500 text-sm">Affects:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {conflict.relatedSymbols.map((sym, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-slate-800 text-gray-300 text-xs rounded"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SUGGESTED FIX */}
        {conflict.suggestedFix && (
          <div className="bg-blue-900/20 rounded p-3 mb-4 border border-blue-800">
            <p className="text-blue-300 text-sm font-semibold mb-2">
              💡 Suggested Fix
            </p>
            <p className="text-gray-300 text-sm">{conflict.suggestedFix.type}</p>
            {conflict.suggestedFix.suggestions && (
              <div className="flex gap-2 mt-2">
                {conflict.suggestedFix.suggestions.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-800/30 text-blue-200 text-xs rounded font-mono"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESOLUTION BUTTONS */}
        <div className="space-y-2 mb-4">
          {config.resolutions.map((resType) => {
            const buttonLabels = {
              rename: "🔤 Rename",
              revert: "↶ Revert",
              "convert-to-let": "⚡ Convert to let",
              declare: "✚ Declare Variable",
              acknowledge: "✓ Acknowledge",
            };

            return (
              <button
                key={resType}
                onClick={() => handleResolve(resType)}
                disabled={resolving}
                className={`w-full py-2 px-3 rounded font-medium text-sm transition-all ${
                  selectedResolution === resType
                    ? "bg-blue-600 text-white scale-105"
                    : "bg-slate-700 text-gray-200 hover:bg-slate-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {resolving && selectedResolution === resType && (
                  <span className="inline-block mr-2">⏳</span>
                )}
                {buttonLabels[resType] || resType}
              </button>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="flex gap-2 pt-3 border-t border-slate-700">
          <button
            onClick={handleDismiss}
            disabled={resolving}
            className="flex-1 py-2 px-3 rounded font-medium text-sm bg-gray-700 text-gray-100 hover:bg-gray-600 transition disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            onClick={onClose}
            disabled={resolving}
            className="flex-1 py-2 px-3 rounded font-medium text-sm bg-slate-600 text-gray-100 hover:bg-slate-500 transition disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;
