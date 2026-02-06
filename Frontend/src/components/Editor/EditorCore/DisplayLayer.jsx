import React, { useRef, useEffect, useMemo } from "react";
import { highlightCode } from "../../../utils/syntaxHighlighter";

const LINE_HEIGHT = 20; // pixels
const TAB_SIZE = 4; // spaces

export default function DisplayLayer({
  lines,
  fileLanguage,
  displayLayerRef,
}) {
  const htmlContentRef = useRef(null);

  // Generate syntax-highlighted HTML (placeholder - will integrate Tree-sitter)
  const highlightedLines = useMemo(() => {
    return lines.map((line, index) => {
      // TODO: Replace with actual Tree-sitter highlighting
      // For now, simple placeholder with HTML escaping
      const escapedLine = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      return {
        lineNum: index + 1,
        content: escapedLine,
        html: `<span class="text-slate-300">${escapedLine}</span>`,
      };
    });
  }, [lines]);

  return (
    <div
      ref={displayLayerRef}
      className="absolute inset-0 overflow-hidden text-slate-200 font-mono text-sm bg-slate-950 z-10 pointer-events-none"
      style={{
        lineHeight: `${LINE_HEIGHT}px`,
      }}
    >
      <div className="px-4 py-2">
        {highlightedLines.map((lineData) => (
          <div
            key={lineData.lineNum}
            className="whitespace-pre-wrap break-words"
            style={{
              height: LINE_HEIGHT,
              minHeight: LINE_HEIGHT,
            }}
            dangerouslySetInnerHTML={{ __html: lineData.html }}
          />
        ))}
      </div>
    </div>
  );
}
