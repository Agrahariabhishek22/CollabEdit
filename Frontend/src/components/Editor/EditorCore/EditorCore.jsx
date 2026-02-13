// components/Editor/EditorCore/index.jsx
import * as Y from "yjs";
import React, { useState, useEffect, useRef, useCallback } from "react";
import GutterPanel from "./GutterPanel";
import DisplayLayer from "./DisplayLayer";
import InputLayer from "./InputLayer";
import OverlayLayer from "./OverlayLayer";
import { useEditor } from "../../../hooks/useEditor";
import WidgetLayer, { detectLanguage } from "./WidgetLayer";
import { useTreeSitter } from "../../../hooks/useTreeSitter";

export default function EditorCore({ selectedFile, accessMode }) {
  const { ydoc, ytext, awarenessStates, updateCursor, isReady } = useEditor();
  const language = detectLanguage(selectedFile?.name);
  // ════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════
  const [lines, setLines] = useState([]);
  const [cursorPosition, setCursorPosition] = useState({ line: 0, column: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0); // ← NEW
  const [layerHeight, setLayerHeight] = useState(0);
  const [lastEditParams, setLastEditParams] = useState(null);

  const scrollContainerRef = useRef(null);
  const inputLayerRef = useRef(null);
  const displayLayerRef = useRef(null);
  const gutterPanelRef = useRef(null);
  const overlayLayerRef = useRef(null);
  const [treeData, setTreeData] = useState({
    tree: null,
    errors: [],
    loading: true,
  });

  // 🟢 Ye function sirf tab chalega jab InputLayer ka parser kaam khatam karega
  const handleTreeUpdate = useCallback((data) => {
    setTreeData(data);
  }, []);
  // ════════════════════════════════════════════════════════════
  // OBSERVER: Split into lines for Gutter & Display
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    console.log(selectedFile);

    if (!isReady) return; // Hook ke andar condition lagao, hook ko skip mat karo
    const observer = () => {
      const content = ytext.toString();
      const contentLines = content.split("\n");
      setLines(contentLines);
      // console.log("lineCount:", lineCount);

      const lineHeight = 24;
      const totalHeight = contentLines.length * lineHeight + 20;
      setLayerHeight(totalHeight);
    };

    ytext.observe(observer);
    observer(); // Initial check

    return () => ytext.unobserve(observer);
  }, [isReady, ytext]);

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

  const handleInputChange = useCallback(
    (deltaOp) => {
      // 🟢 editParams yahan receive hoga
      if (!deltaOp || !deltaOp.type) return;

      const { type, index } = deltaOp;

      // 🟢 Existing Yjs Transaction (Logic preserved)
      ydoc.transact(() => {
        if (type === "delete") {
          const { length } = deltaOp;
          if (length > 0) {
            ytext.delete(index, length);
          }
        } else if (type === "insert") {
          const { text } = deltaOp;
          if (text && text.length > 0) {
            ytext.insert(index, text);
          }
        }
      });
    },
    [ytext, ydoc],
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

  // handling delta insert from widget layer(autocomplete)
  const handleDeltaInsert = useCallback(
    (deltaOp) => {
      // 🟢 Pass delta to InputLayer
      handleInputChange(deltaOp);

      // 🟢 Move cursor after inserted text
      if (deltaOp.type === "insert" && inputLayerRef.current) {
        const newCursorPos = deltaOp.index + deltaOp.text.length;

        setTimeout(() => {
          if (inputLayerRef.current) {
            inputLayerRef.current.selectionStart = newCursorPos;
            inputLayerRef.current.selectionEnd = newCursorPos;
            inputLayerRef.current.focus();
          }
        }, 0);
      }
    },
    [handleInputChange],
  );

  const handleSmartIndent = useCallback(
    (indent) => {
      const textarea = inputLayerRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // 1. Naya text create karo (Jo line insert karni hai)
      const textToInsert = "\n" + indent;

      // 2. State update karo (Handle input change ko poora text bhej rahe ho ya partial?)
      // Agar tumhara function pura value update karta hai:
      handleInputChange({
        type: "insert",
        index: start,
        text: textToInsert,
      });

      // 3. Cursor position logic:
      // Naya index = jahan cursor tha + pichla enter + jitne spaces aaye
      const targetPos = start + textToInsert.length;

      // Use setTimeout(0) or requestAnimationFrame - but with a small check
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(targetPos, targetPos);

        // Bonus: Scroll adjustment taaki cursor screen ke bahar na jaye
        const lineHeight = 24; // Adjust according to your CSS
        const currentLine = value.substr(0, start).split("\n").length;
        textarea.scrollTop =
          currentLine * lineHeight - textarea.clientHeight / 2;
      }, 0);
    },
    [handleInputChange, inputLayerRef],
  );

  // ════════════════════════════════════════════════════════════
  // READ-ONLY MODE: If user is VIEWER
  // ════════════════════════════════════════════════════════════
  const isReadOnly = accessMode === "VIEWER";
  // 3. AB SARE HOOKS KE BAAD CONDITION LAGAO
  if (!isReady) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-white">
        Syncing with server...
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-slate-950 overflow-hidden">
      {/* GUTTER PANEL (Line Numbers) - FIXED OUTSIDE SCROLL */}

      {/* 1. MASTER SCROLL CONTAINER: Sirf ye scroll hoga */}
      <div
        ref={scrollContainerRef}
        className="flex-1 relative overflow-auto flex flex-row "
        onScroll={handleScroll}
        // style={{ height: "100%" }}
      >
        {/* 2. GUTTER AREA: Left side fixed width */}
        <div className="w-12 sticky left-0 z-30 bg-slate-900 border-r border-slate-800">
          <GutterPanel ref={gutterPanelRef} lines={lines} errors={treeData.errors} />
        </div>

        {/* 3. EDITOR CONTENT AREA: Right side bacha hua space */}
        <div className="flex-1 relative">
          <DisplayLayer
            ref={displayLayerRef}
            lines={lines}
            selectedFile={selectedFile}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
            errors={treeData.errors}
          />
          <InputLayer
            ref={inputLayerRef}
            content={ytext.toString()}
            onChange={handleInputChange}
            onCursorChange={handleCursorChange}
            isReadOnly={isReadOnly}
            onTreeUpdate={handleTreeUpdate} // Callback pass kiya
          />
          <OverlayLayer
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
            awarenessStates={awarenessStates}
            layerHeight={layerHeight}
            // currentUserId={currentUserId}
          />
          <WidgetLayer
            content={ytext.toString()}
            scrollTop={scrollTop}
            scrollLeft={scrollLeft}
            inputLayerRef={inputLayerRef}
            onDeltaInsert={handleDeltaInsert}
            onSmartIndent={handleSmartIndent}
            tree={treeData.tree}
            errors={treeData.errors}
            loading={treeData.loading}
            language={language}
          />
          {/* 4. GHOST DIV: Browser ko scrollbar dene ke liye majboor karega */}
          <div
            style={{
              height: `${lines.length * 24}px`,
              width: "1000px", // ← CHANGE: "2000px" se "100%" kar de
            }}
          />
        </div>
      </div>
    </div>
  );
}
