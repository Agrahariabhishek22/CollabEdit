// components/Editor/EditorCore/DisplayLayer.jsx

import React, { forwardRef, useMemo } from "react";
import {  applyHighlights, highlightCodeWithTreeSitter } from "../../../utils/syntaxHighlighter";
import { useTreeSitter } from "../../../hooks/useTreeSitter";

const DisplayLayer = forwardRef(({ lines, selectedFile, scrollTop, scrollLeft }, ref) => {
    const language = detectLanguage(selectedFile?.name);
  const content = lines.join("\n");
  
  // 🟢 Get tree from useTreeSitter
  const { tree } = useTreeSitter(content, language);

  // 🟢 Generate highlights from tree
  const highlights = useMemo(() => {
    if (!tree) return [];
    return highlightCodeWithTreeSitter(content, tree, language);
  }, [tree, content, language]);

  // 🟢 Apply highlights to HTML
  const highlightedHtml = useMemo(() => {
    return applyHighlights(content, highlights);
  }, [content, highlights]);

  // Split into lines for rendering
  const htmlLines = highlightedHtml.split("\n");

  return (
    <div
      ref={ref}
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: "14px",
        zIndex: 0,
        lineHeight: "24px",
        padding: "10px",
        boxSizing: "border-box",
        height: `${lines.length * 24 + 20}px`,
        transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`, // ← BOTH TRANSFORMS
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
      {htmlLines.map((htmlLine, idx) => (
        <div
          key={idx}
          style={{
            whiteSpace: "pre",
            height: "24px",
            width:"max-content",
            lineHeight: "24px",
            flexShrink: 0,
            overflow: "hidden",
            margin: 0,
            padding: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: htmlLine || "&nbsp;",
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
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "cpp",
    go: "go",
  };
  return langMap[ext] || "javascript";
}

export default DisplayLayer;