import React, { useMemo } from "react";

const CHAR_WIDTH = 8.4;
const LINE_HEIGHT = 20;

/**
 * ConflictMarkers Component
 * 
 * Renders visual conflict markers (<<<<<<, ======, >>>>>>) for merge conflicts
 * 
 * Data Flow:
 * 1. Backend detects semantic conflict (e.g., function renamed)
 * 2. Injects conflict markers into yText
 * 3. Markers appear in editor as special text
 * 4. This component highlights the conflict region
 * 5. User manually resolves by editing
 * 6. On save, markers removed by backend validation
 */
export default function ConflictMarkers({
  conflicts,
  scrollTop,
  editorPaddingLeft = 64,
}) {
  const conflictRanges = useMemo(() => {
    if (!conflicts || conflicts.length === 0) return [];

    return conflicts.map((conflict, index) => {
      const startLine = conflict.range?.start?.line || 0;
      const endLine = conflict.range?.end?.line || startLine + 5;

      const y = startLine * LINE_HEIGHT - scrollTop;
      const height = (endLine - startLine + 1) * LINE_HEIGHT;

      return {
        id: `conflict-${index}`,
        startLine,
        endLine,
        y,
        height,
        message: conflict.message || "Merge conflict detected",
      };
    });
  }, [conflicts, scrollTop]);

  return (
    <>
      {conflictRanges.map((conflict) => {
        // Skip if off-screen
        if (conflict.y + conflict.height < -50 || conflict.y > window.innerHeight + 50) {
          return null;
        }

        return (
          <div
            key={conflict.id}
            className="absolute pointer-events-none group"
            style={{
              left: editorPaddingLeft,
              top: `${conflict.y}px`,
              width: "calc(100% - 64px)",
              height: `${conflict.height}px`,
            }}
          >
            {/* Red border around conflict region */}
            <div
              className="absolute inset-0 border-l-4 border-red-500 bg-red-500/10"
              style={{
                animation: "pulse 2s infinite",
              }}
            />

            {/* Conflict warning label */}
            <div className="absolute -left-12 top-0 bg-red-500 text-white text-xs px-2 py-1 rounded font-semibold opacity-0 group-hover:opacity-100 transition-opacity z-50">
              ⚠ CONFLICT
            </div>

            {/* Tooltip on hover */}
            <div className="absolute -left-64 top-0 bg-slate-800 text-slate-100 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-50 border border-slate-700 whitespace-nowrap">
              {conflict.message}
            </div>
          </div>
        );
      })}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
