// components/Editor/EditorCore/DisplayLayer.jsx - INTEGRATED WITH ERRORS

import React, { forwardRef, useMemo, useState, useEffect } from "react";
import { highlightCode } from "../../../utils/syntaxHighlighter copy";

const DisplayLayer = forwardRef(
  (
    {
      lines,
      selectedFile,
      scrollTop,
      scrollLeft,
      errors
    },
    ref
  ) => {

    // ============================================================================
    // EXISTING LOGIC - highlighting (UNCHANGED)
    // ============================================================================
    const highlightedLines = useMemo(() => {
      const language = detectLanguage(selectedFile?.name);
      const fullContent = lines.join("\n");
      const fullHtml = highlightCode(fullContent, language);
      return fullHtml.split("\n");
    }, [lines, selectedFile]);

    return (
      <div
        ref={ref}
        className="absolute inset-0 pointer-events-none select-none overflow-hidden "
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: "14px",
          zIndex: 0,
          lineHeight: "24px",
          padding: "10px",
          boxSizing: "border-box",
          height: `${lines.length * 24 + 20}px`,
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
          width: "4000px",
        }}
      >
        {/* ============================================================================
            EXISTING: Highlighted lines (UNCHANGED)
            ============================================================================ */}
        {highlightedLines.map((htmlLine, idx) => (
          <div
            key={idx}
            style={{
              whiteSpace: "pre",
              height: "24px",
              width: "max-content",
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

        {/* ============================================================================
            ✅ NEW: Error underlines (same pattern as WidgetLayer)
            ============================================================================ */}
        {/* {errors.length > 0 && (
          <ErrorOverlay
            errors={errors}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
            // content={content}
          />
        )} */}
      </div>
    );
  }
);

DisplayLayer.displayName = "DisplayLayer";

/**
 * ✅ NEW: Error overlay component
 * Shows red wavy underlines for errors
 */
function ErrorOverlay({ errors, scrollTop, scrollLeft }) {
  const LINE_HEIGHT = 24;
  const CHAR_WIDTH = 8.43;

  return (
    <div className="absolute top-0 left-0 pointer-events-none">
      {errors.map((error, idx) => {
        // ✅ Recalculate position from content for accuracy
        let displayLine = error.line;
        let displayColumn = error.column;

        // if (content && error.startIndex !== undefined) {
        //   const beforeError = content.substring(0, error.startIndex);
        //   const linesSplit = beforeError.split("\n");
        //   displayLine = linesSplit.length - 1;
        //   displayColumn = linesSplit[linesSplit.length - 1].length;
        // }

        // ✅ Calculate position
        const x = displayColumn * CHAR_WIDTH + 10;
        const y = displayLine * LINE_HEIGHT + 10;

        const errorWidth = Math.max(
          (error.endColumn - error.column) * CHAR_WIDTH,
          CHAR_WIDTH
        );

        return (
          <div
            key={`error-${idx}`}
            className="absolute pointer-events-auto group"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${errorWidth}px`,
              height: `${LINE_HEIGHT}px`,
              transform: `translate(-${scrollLeft}px, -${scrollTop}px)`,
              willChange: "transform",
            }}
          >
            {/* Wavy Underline */}
            <div
              className="absolute bottom-0 left-0 border-b-2 border-dashed w-full"
              style={{
                borderColor:
                  error.severity === "error"
                    ? "#ef4444" // Red for errors
                    : error.severity === "warning"
                      ? "#f59e0b" // Amber for warnings
                      : "#3b82f6", // Blue for info
                height: "4px",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2 Q 1.5 0, 3 2 T 6 2' fill='none' stroke='${
                  error.severity === "error"
                    ? "%23ef4444"
                    : error.severity === "warning"
                      ? "%23f59e0b"
                      : "%233b82f6"
                }' stroke-width='2'/%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat-x",
                border: "none",
              }}
            />

            {/* Tooltip on hover */}
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-[100]">
              {error.type}: {error.message}
              <div className="absolute top-full left-2 border-4 border-transparent border-t-red-600" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

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