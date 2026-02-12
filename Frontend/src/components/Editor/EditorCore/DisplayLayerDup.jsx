import React, { forwardRef, useMemo } from "react";
import { applyHighlights, highlightCodeWithTreeSitterInRange } from "../../../utils/syntaxHighlighter";
import { useEffect } from "react";

const DisplayLayer = forwardRef(({ 
  lines, 
  selectedFile, 
  scrollTop, 
  scrollLeft, 
  tree, // Tree prop se aa raha hai
  lineHeight = 24 
}, ref) => {
  
  const language = detectLanguage(selectedFile?.name);

  // 1. Line offsets calculate karo (Sirf content change hone par)
  // Ye zaroori hai tree-sitter indices ko line numbers se map karne ke liye
  const lineOffsets = useMemo(() => {
    let currentOffset = 0;
    return lines.map((line) => {
      const start = currentOffset;
      currentOffset += line.length + 1; // +1 for \n
      return start;
    });
  }, [lines]);

  // 2. Visible Range Calculation (Live based on scroll)
  const containerHeight = 800; // Isko prop se bhi le sakte ho window.innerHeight
  const startLine = Math.floor(scrollTop / lineHeight);
  const visibleCount = Math.ceil(containerHeight / lineHeight);
  const endLine = Math.min(lines.length, startLine + visibleCount + 2); // +2 buffer

  // 3. Live Range Highlighting logic
  const visibleRows = useMemo(() => {
    if (!tree || lines.length === 0) return [];

    const fullContent = lines.join("\n");
    const rangeStart = lineOffsets[startLine];
    const rangeEnd = lineOffsets[endLine] || fullContent.length;

    // Sirf is range ke liye nodes fetch karo (Performance 🚀)
    const rangeHighlights = highlightCodeWithTreeSitterInRange(
      fullContent,
      tree,
      language,
      rangeStart,
      rangeEnd
    );

    const rows = [];
    for (let i = startLine; i < endLine; i++) {
      const lineText = lines[i] || "";
      const lStart = lineOffsets[i];
      const lEnd = lStart + lineText.length;

      // Filter highlights jo is specific line ke andar fall karte hain
      const lineHighlights = rangeHighlights
        .filter(h => h.startIndex < lEnd && h.endIndex > lStart)
        .map(h => ({
          ...h,
          startIndex: Math.max(0, h.startIndex - lStart),
          endIndex: Math.min(lineText.length, h.endIndex - lStart),
        }));

      rows.push({
        index: i,
        html: applyHighlights(lineText, lineHighlights)
      });
    }
    return rows;
  }, [tree, lines, startLine, endLine, lineOffsets, language]);
  useEffect(()=>{
    console.log(visibleRows);
  },[visibleRows])
  
  return (
    <div
      ref={ref}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: "14px",
        zIndex: 0,
        lineHeight: `${lineHeight}px`,
        padding: "10px",
        boxSizing: "border-box",
        height: `${lines.length * lineHeight + 20}px`,
        // Transform handles vertical and horizontal sync
        transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`,
        willChange: "transform",
        transition: "none",
        backgroundColor: "transparent",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
        overflow: "hidden",
        width: "4000px"
      }}
    >
      {/* Hum poora map nahi kar rahe, sirf visible rows render kar rahe hain */}
      {visibleRows.map((row) => (
        <div
          key={row.index}
          style={{
            position: "absolute", // Absolute position taaki wo apni sahi jagah par rahe
            top: `${row.index * lineHeight}px`,
            whiteSpace: "pre",
            height: `${lineHeight}px`,
            width: "max-content",
            lineHeight: `${lineHeight}px`,
            flexShrink: 0,
            overflow: "hidden",
            margin: 0,
            padding: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: row.html || "&nbsp;",
          }}
        />
      ))}
    </div>
  );
});

DisplayLayer.displayName = "DisplayLayer";

function detectLanguage(filename) {
  if (!filename) return "javascript";
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap = {
    js: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", java: "java",
    cpp: "cpp", c: "cpp", go: "go",
    rb: "ruby"
  };
  return langMap[ext] || "javascript";
}

export default React.memo(DisplayLayer);