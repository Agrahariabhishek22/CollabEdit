// components/Editor/EditorCore/index.jsx
import * as Y from "yjs";
import React, { useState, useEffect, useRef, useCallback } from "react";
import GutterPanel from "./GutterPanel";
import DisplayLayer from "./DisplayLayer";
import InputLayer from "./InputLayer";
import OverlayLayer from "./OverlayLayer";
import { useEditor } from "../../../hooks/useEditor";

export default function EditorCore({
  selectedFile,
  accessMode,
  initialBinary,
}) {
  const { ydoc, ytext, awarenessStates, updateCursor } = useEditor();

  // ════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════
  const [lines, setLines] = useState([]);
  const [cursorPosition, setCursorPosition] = useState({ line: 0, column: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0); // ← NEW

  const scrollContainerRef = useRef(null);
  const inputLayerRef = useRef(null);
  const displayLayerRef = useRef(null);
  const gutterPanelRef = useRef(null);
  const overlayLayerRef = useRef(null);

  // ════════════════════════════════════════════════════════════
  // YJS OBSERVER: Update lines when ytext changes
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (initialBinary && ydoc) {
      try {
        const uint8 = new Uint8Array(initialBinary);
        Y.applyUpdate(ydoc, uint8);
        console.log("✅ [EditorCore] Binary applied to Y.Doc");
      } catch (err) {
        console.error("❌ [EditorCore] Hydration failed:", err);
      }
    }
  }, [initialBinary, ydoc]);

  // ════════════════════════════════════════════════════════════
  // OBSERVER: Split into lines for Gutter & Display
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    const observer = () => {
      const content = ytext.toString();
      const contentLines = content.split("\n");
      setLines(contentLines);
    };

    ytext.observe(observer);
    observer(); // Initial check

    return () => ytext.unobserve(observer);
  }, [ytext]);

  // ════════════════════════════════════════════════════════════
  // SCROLL SYNC: Use requestAnimationFrame for smooth, sync'd scroll
  // ════════════════════════════════════════════════════════════
  const handleScroll = useCallback((e) => {
    const { scrollTop: newScrollTop, scrollLeft: newScrollLeft } = e.target;

    // React state update (Optional: for components that need it)
    setScrollTop(newScrollTop);
    setScrollLeft(newScrollLeft);

    // 1. Vertical Sync: Sabko upar khiskao (including Gutter)
    const verticalLayers = [
      displayLayerRef,
      inputLayerRef,
      gutterPanelRef,
      overlayLayerRef,
    ];
    verticalLayers.forEach((ref) => {
      if (ref.current) {
        // Humne transform ko modify kiya taaki vertical aur horizontal dono handle ho sakein
        // Lekin Gutter horizontal scroll nahi hona chahiye!
        if (ref === gutterPanelRef) {
          ref.current.style.transform = `translateY(-${newScrollTop}px)`;
        } else {
          // Baaki layers vertical aur horizontal dono move hongi
          ref.current.style.transform = `translateY(-${newScrollTop}px) translateX(-${newScrollLeft}px)`;
        }
      }
    });
    // console.log(`[Editor Core] scrolltop:${newScrollTop} and srcollleft:${newScrollLeft}`);
    
  }, []);

  // ════════════════════════════════════════════════════════════
  // INPUT HANDLER: When user types
  // ════════════════════════════════════════════════════════════
  const handleInputChange = useCallback(
    (newContent) => {
      const currentContent = ytext.toString();

      if (newContent === currentContent) return;

      // Replace entire content
      ytext.delete(0, currentContent.length);
      ytext.insert(0, newContent);

      console.log("[EditorCore] Content updated via Yjs");
    },
    [ytext],
  );

  // ════════════════════════════════════════════════════════════
  // CURSOR HANDLER: Track cursor position
  // ════════════════════════════════════════════════════════════
  const handleCursorChange = useCallback(
    (line, column) => {
      setCursorPosition({ line, column });
      updateCursor(line, column);
    },
    [updateCursor],
  );

  // ════════════════════════════════════════════════════════════
  // READ-ONLY MODE: If user is VIEWER
  // ════════════════════════════════════════════════════════════
  const isReadOnly = accessMode === "VIEWER";

  return (
    <div className="flex-1 flex bg-slate-950 overflow-hidden">
      {/* GUTTER PANEL (Line Numbers) - FIXED OUTSIDE SCROLL */}

      {/* 1. MASTER SCROLL CONTAINER: Sirf ye scroll hoga */}
      <div
        ref={scrollContainerRef}
        className="flex-1 relative overflow-auto flex flex-row "
        onScroll={handleScroll}
        style={{ height: "100%" }}
      >
        {/* 2. GUTTER AREA: Left side fixed width */}
        <div className="w-12 sticky left-0 z-30 bg-slate-900 border-r border-slate-800">
          <GutterPanel ref={gutterPanelRef} lines={lines} />
        </div>

        {/* 3. EDITOR CONTENT AREA: Right side bacha hua space */}
        <div className="flex-1 relative">
          <DisplayLayer
            ref={displayLayerRef}
            lines={lines}
            selectedFile={selectedFile}
            scrollLeft={scrollLeft}
          />
          <InputLayer
            ref={inputLayerRef}
            content={ytext.toString()}
            onChange={handleInputChange}
            onCursorChange={handleCursorChange}
            isReadOnly={isReadOnly}
            scrollLeft={scrollLeft}
          />
          {/* <OverlayLayer
            ref={overlayLayerRef}
            awarenessStates={awarenessStates}
            cursorPosition={cursorPosition}
                        scrollLeft={scrollLeft}

          /> */}
          {/* 4. GHOST DIV: Browser ko scrollbar dene ke liye majboor karega */}
          <div
            style={{
              height: `${lines.length * 24}px`,
              width: "100%", // ← CHANGE: "2000px" se "100%" kar de
            }}
          />
          {" "}
        </div>
      </div>
    </div>
  );
}
