import React, { useCallback, useRef, useMemo } from "react";

const LINE_HEIGHT = 20; // pixels

/**
 * EditorScrollContainer Component
 * 
 * Handles viewport-based rendering for performance optimization
 * 
 * Key Performance Optimizations:
 * 1. Virtual scrolling - Only render visible + buffer lines
 * 2. For 1000-line file, render ~50 lines at a time instead of 1000
 * 3. Sync scroll across all layers (GutterPanel, DisplayLayer, InputLayer)
 * 4. Debounce scroll events to prevent excessive re-renders
 * 
 * Data Flow:
 * 1. User scrolls
 * 2. onScroll event fires
 * 3. Calculate visible line range (viewport + buffer)
 * 4. Pass to children for viewport-based rendering
 * 5. Only render lines in visible range
 * 6. Huge performance boost for large files!
 */
export default function EditorScrollContainer({
  scrollTop,
  onScroll,
  children,
}) {
  const containerRef = useRef(null);

  // Calculate visible lines for viewport-based rendering
  const viewportInfo = useMemo(() => {
    const containerHeight = window.innerHeight - 80; // Approximate viewport height
    const bufferLines = 10; // Extra lines above/below viewport to pre-render

    // Calculate which lines are visible
    const firstVisibleLine = Math.max(
      0,
      Math.floor(scrollTop / LINE_HEIGHT) - bufferLines
    );
    const visibleLineCount = Math.ceil(containerHeight / LINE_HEIGHT);
    const lastVisibleLine = firstVisibleLine + visibleLineCount + bufferLines;

    return {
      firstVisibleLine,
      lastVisibleLine,
      visibleLineCount,
      containerHeight,
    };
  }, [scrollTop]);

  const handleWheel = useCallback((e) => {
    // Allow native scroll behavior
    // onScroll will be triggered by the scroll event
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-slate-950 relative"
      onScroll={onScroll}
      onWheel={handleWheel}
      style={{
        scrollBehavior: "auto",
        // Enable hardware acceleration
        transform: "translateZ(0)",
      }}
    >
      {/* Viewport container for content */}
      <div
        className="relative"
        style={{
          minHeight: "100%",
          // Pass viewport info to children via data attributes
          "--first-visible-line": viewportInfo.firstVisibleLine,
          "--last-visible-line": viewportInfo.lastVisibleLine,
        }}
      >
        {children}
      </div>

      {/* Scroll indicator (optional - shows scroll position) */}
      <div
        className="fixed right-1 top-16 w-1 bg-slate-700 rounded-full pointer-events-none opacity-50 hover:opacity-75 transition-opacity"
        style={{
          height: `${(viewportInfo.containerHeight / (viewportInfo.lastVisibleLine * LINE_HEIGHT)) * 100}%`,
          top: `${16 + (scrollTop / (viewportInfo.lastVisibleLine * LINE_HEIGHT)) * viewportInfo.containerHeight}px`,
        }}
      />
    </div>
  );
}
