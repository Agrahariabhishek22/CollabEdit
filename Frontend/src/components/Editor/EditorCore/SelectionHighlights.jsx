import React, { useMemo } from "react";

const CHAR_WIDTH = 8.4;
const LINE_HEIGHT = 20;

/**
 * SelectionHighlights Component
 * 
 * Shows selection ranges of other collaborators with different colors
 * 
 * Data Flow:
 * 1. Listen to awareness.on('change')
 * 2. Get selection range from each remote user { startLine, startCol, endLine, endCol }
 * 3. Calculate pixel positions for all selected lines
 * 4. Render colored background highlight for selection
 * 5. Update when awareness changes
 */
export default function SelectionHighlights({
  selections,
  scrollTop,
  editorPaddingLeft = 64,
}) {
  const USER_COLORS = [
    { bg: "bg-blue-500/20", border: "border-blue-500" },
    { bg: "bg-green-500/20", border: "border-green-500" },
    { bg: "bg-yellow-500/20", border: "border-yellow-500" },
    { bg: "bg-purple-500/20", border: "border-purple-500" },
    { bg: "bg-pink-500/20", border: "border-pink-500" },
    { bg: "bg-cyan-500/20", border: "border-cyan-500" },
  ];

  const highlightRanges = useMemo(() => {
    if (!selections || selections.length === 0) return [];

    return selections.map((selection, index) => {
      const startLine = selection.start?.line || 0;
      const startCol = selection.start?.column || 0;
      const endLine = selection.end?.line || startLine;
      const endCol = selection.end?.column || startCol + 10;

      // Single line selection
      if (startLine === endLine) {
        const x = editorPaddingLeft + startCol * CHAR_WIDTH;
        const y = startLine * LINE_HEIGHT - scrollTop;
        const width = (endCol - startCol) * CHAR_WIDTH;

        return {
          id: `sel-${index}`,
          x,
          y,
          width,
          height: LINE_HEIGHT,
          color: USER_COLORS[index % USER_COLORS.length],
          userName: selection.userName,
        };
      }

      // Multi-line selection
      const ranges = [];
      for (let line = startLine; line <= endLine; line++) {
        const lineStartCol = line === startLine ? startCol : 0;
        const lineEndCol = line === endLine ? endCol : 999; // Max columns

        const y = line * LINE_HEIGHT - scrollTop;
        const x = editorPaddingLeft + lineStartCol * CHAR_WIDTH;
        const width = (lineEndCol - lineStartCol) * CHAR_WIDTH;

        ranges.push({
          id: `sel-${index}-${line}`,
          x,
          y,
          width,
          height: LINE_HEIGHT,
          color: USER_COLORS[index % USER_COLORS.length],
          userName: selection.userName,
        });
      }

      return ranges;
    }).flat();
  }, [selections, scrollTop, editorPaddingLeft]);

  return (
    <>
      {highlightRanges.map((highlight) => {
        // Skip if off-screen
        if (highlight.y < -50 || highlight.y > window.innerHeight + 50) {
          return null;
        }

        return (
          <div
            key={highlight.id}
            className="absolute pointer-events-none group"
            style={{
              left: `${highlight.x}px`,
              top: `${highlight.y}px`,
              width: `${highlight.width}px`,
              height: `${highlight.height}px`,
              backgroundColor: highlight.color.bg.split("/")[0].replace("bg-", "rgba(") + ",0.2)",
            }}
          >
            {/* User label on first line */}
            {highlight.id.includes("-0") && (
              <div className="absolute -top-6 left-0 text-xs font-medium text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                📝 {highlight.userName}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
