import React, { useMemo } from "react";

const CHAR_WIDTH = 8.4;
const LINE_HEIGHT = 20;

/**
 * ErrorSquiggles Component
 * 
 * Renders wavy red underlines for syntax/semantic errors from LSP
 * 
 * Data Flow:
 * 1. Receive diagnostics from EditorCore props
 * 2. Map diagnostics to pixel positions (line/column → x/y)
 * 3. Calculate width from character range
 * 4. Render SVG or div with wavy border-bottom
 * 5. Update when diagnostics change
 */
export default function ErrorSquiggles({
  diagnostics,
  scrollTop,
  editorPaddingLeft = 64, // Gutter width + padding
}) {
  const squiggles = useMemo(() => {
    if (!diagnostics || diagnostics.length === 0) return [];

    return diagnostics.map((diag, index) => {
      const startLine = diag.range?.start?.line || 0;
      const startCol = diag.range?.start?.character || 0;
      const endCol = diag.range?.end?.character || startCol + 10;

      // Calculate pixel position
      const x = editorPaddingLeft + startCol * CHAR_WIDTH;
      const y = startLine * LINE_HEIGHT - scrollTop;
      const width = (endCol - startCol) * CHAR_WIDTH;

      // Determine color based on severity
      const color =
        diag.severity === "error"
          ? "#ef4444" // Red
          : diag.severity === "warning"
          ? "#f59e0b" // Amber
          : "#3b82f6"; // Blue

      return {
        id: `${startLine}-${startCol}-${index}`,
        x,
        y,
        width,
        color,
        message: diag.message,
        severity: diag.severity,
      };
    });
  }, [diagnostics, scrollTop, editorPaddingLeft]);

  return (
    <>
      {squiggles.map((squiggle) => {
        // Skip if off-screen
        if (squiggle.y < -50 || squiggle.y > window.innerHeight + 50) {
          return null;
        }

        return (
          <div
            key={squiggle.id}
            className="absolute pointer-events-none group"
            style={{
              left: `${squiggle.x}px`,
              top: `${squiggle.y}px`,
              width: `${squiggle.width}px`,
              height: `${LINE_HEIGHT}px`,
            }}
            title={squiggle.message}
          >
            {/* Wavy underline using SVG */}
            <svg
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${squiggle.width} ${LINE_HEIGHT}`}
              style={{
                pointerEvents: "none",
              }}
            >
              {/* Wavy line pattern */}
              <defs>
                <pattern
                  id={`wavy-${squiggle.id}`}
                  x="0"
                  y="0"
                  width="10"
                  height="3"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 0,1 Q 2.5,0 5,1 T 10,1"
                    fill="none"
                    stroke={squiggle.color}
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              {/* Bottom border wavy line */}
              <rect
                x="0"
                y={LINE_HEIGHT - 3}
                width="100%"
                height="3"
                fill={`url(#wavy-${squiggle.id})`}
              />
            </svg>

            {/* Hover tooltip */}
            <div className="absolute bottom-full mb-1 left-0 bg-slate-800 text-slate-100 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-50 whitespace-nowrap border border-slate-700">
              {squiggle.severity}: {squiggle.message}
            </div>
          </div>
        );
      })}
    </>
  );
}
