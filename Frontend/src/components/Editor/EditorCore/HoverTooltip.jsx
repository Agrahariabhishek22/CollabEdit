import React, { useState, useEffect, useRef } from "react";

const CHAR_WIDTH = 8.4;
const LINE_HEIGHT = 20;

/**
 * HoverTooltip Component
 * 
 * Shows type information and documentation on hover (from LSP)
 * 
 * Data Flow:
 * 1. User hovers over identifier (mouse over editor)
 * 2. Get text at cursor position
 * 3. Extract identifier
 * 4. Emit 'lsp:hover' to backend
 * 5. Backend LSP responds with hover info (type, docs)
 * 6. Render tooltip at cursor position
 * 7. Auto-hide after 5 seconds or when mouse moves away
 */
export default function HoverTooltip({
  isVisible,
  hoverData,
  position,
  scrollTop,
}) {
  const tooltipRef = useRef(null);

  if (!isVisible || !hoverData) {
    return null;
  }

  // Calculate tooltip position
  const x = position.column * CHAR_WIDTH + 64; // 64px for gutter
  const y = position.line * LINE_HEIGHT - scrollTop + LINE_HEIGHT + 5;

  const { type, documentation, signatureHelp } = hoverData;

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 p-3 max-w-xs pointer-events-none"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        animation: "fadeIn 0.2s ease-in-out",
      }}
    >
      {/* Type signature */}
      {type && (
        <div className="font-mono text-sm text-blue-300 mb-2 overflow-auto max-h-32">
          {type}
        </div>
      )}

      {/* Documentation */}
      {documentation && (
        <div className="text-xs text-slate-300 mb-2 max-h-40 overflow-auto">
          {documentation}
        </div>
      )}

      {/* Function signature help */}
      {signatureHelp && (
        <div className="text-xs text-slate-400 border-t border-slate-700 pt-2 mt-2">
          <div className="font-semibold text-slate-200 mb-1">
            Function signature:
          </div>
          <div className="font-mono text-slate-300">
            {signatureHelp}
          </div>
        </div>
      )}

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
