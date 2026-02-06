import React, { useState, useEffect, useRef, useCallback } from "react";
import GutterPanel from "./GutterPanel";
import EditorLayers from "./EditorLayers";
import EditorScrollContainer from "./EditorScrollContainer";
import { useSocket } from "../../../hooks/useSocket";

export default function EditorCore({
  selectedFile,
  editorContent,
  setEditorContent,
}) {
  const [lines, setLines] = useState([]);
  const [diagnostics, setDiagnostics] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ line: 0, column: 0 });
  const [awarenessStates, setAwarenessStates] = useState([]);
  const [selections, setSelections] = useState([]);
  const [autocomplete, setAutocomplete] = useState({
    isOpen: false,
    suggestions: [],
    selectedIndex: 0,
    onSelect: null,
    onClose: null,
  });
  const [hoverInfo, setHoverInfo] = useState({
    isVisible: false,
    data: null,
    position: { line: 0, column: 0 },
  });
  
  const editorRef = useRef(null);
  const inputLayerRef = useRef(null);
  const displayLayerRef = useRef(null);
  const { socket } = useSocket();
  const currentUserId = localStorage.getItem("userId") || "anonymous";

  // Initialize content lines
  useEffect(() => {
    if (editorContent) {
      const contentLines = editorContent.split("\n");
      setLines(contentLines);
    }
  }, [editorContent]);

  // Handle scroll sync
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    setScrollTop(scrollTop);

    // Sync display and input layers
    if (displayLayerRef.current) {
      displayLayerRef.current.scrollTop = scrollTop;
    }
    if (inputLayerRef.current) {
      inputLayerRef.current.scrollTop = scrollTop;
    }
  }, []);

  // Handle input from InputLayer
  const handleInputChange = useCallback(
    (newContent) => {
      setEditorContent(newContent);
      const contentLines = newContent.split("\n");
      setLines(contentLines);

      // Emit to socket for real-time sync (Yjs will handle this)
      socket?.emit("editor:content-change", {
        fileId: selectedFile?.id,
        projectId: selectedFile?.projectId,
        content: newContent,
      });
    },
    [setEditorContent, socket, selectedFile]
  );

  // Handle cursor position tracking
  const handleCursorChange = useCallback(
    (line, column) => {
      setCursorPosition({ line, column });

      // Emit awareness update (for collaborative cursors)
      socket?.emit("editor:cursor-update", {
        fileId: selectedFile?.id,
        projectId: selectedFile?.projectId,
        line,
        column,
      });
    },
    [socket, selectedFile]
  );

  // Listen for LSP diagnostics
  useEffect(() => {
    if (!socket) return;

    const handleDiagnostics = (data) => {
      setDiagnostics(data.diagnostics || []);
    };

    const handleConflicts = (data) => {
      setConflicts(data.conflicts || []);
    };

    const handleAwarenessChange = (data) => {
      setAwarenessStates(data.states || []);
    };

    const handleSelections = (data) => {
      setSelections(data.selections || []);
    };

    const handleHoverInfo = (data) => {
      setHoverInfo({
        isVisible: true,
        data: data.info,
        position: data.position,
      });

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setHoverInfo((prev) => ({ ...prev, isVisible: false }));
      }, 5000);
    };

    socket.on("lsp:diagnostics", handleDiagnostics);
    socket.on("conflict:detected", handleConflicts);
    socket.on("awareness:change", handleAwarenessChange);
    socket.on("editor:selections", handleSelections);
    socket.on("lsp:hover-info", handleHoverInfo);

    return () => {
      socket.off("lsp:diagnostics", handleDiagnostics);
      socket.off("conflict:detected", handleConflicts);
      socket.off("awareness:change", handleAwarenessChange);
      socket.off("editor:selections", handleSelections);
      socket.off("lsp:hover-info", handleHoverInfo);
    };
  }, [socket]);

  // Autocomplete handlers
  const handleAutocompleteSelect = useCallback(
    (suggestion) => {
      // Insert suggestion into text at cursor position
      const offset =
        lines
          .slice(0, cursorPosition.line)
          .reduce((sum, line) => sum + line.length + 1, 0) + cursorPosition.column;

      const newContent =
        editorContent.slice(0, offset) +
        suggestion.label +
        editorContent.slice(offset);

      setEditorContent(newContent);
      setAutocomplete((prev) => ({ ...prev, isOpen: false }));
    },
    [editorContent, cursorPosition, lines, setEditorContent]
  );

  const closeAutocomplete = useCallback(() => {
    setAutocomplete((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <div ref={editorRef} className="flex-1 flex bg-slate-950 overflow-hidden">
      {/* Gutter Panel (Line Numbers + Error Icons) */}
      <GutterPanel
        lines={lines}
        diagnostics={diagnostics}
        scrollTop={scrollTop}
      />

      {/* Editor Scroll Container */}
      <EditorScrollContainer scrollTop={scrollTop} onScroll={handleScroll}>
        {/* Editor Layers (Display + Input + Overlay + Widget) */}
        <EditorLayers
          lines={lines}
          editorContent={editorContent}
          diagnostics={diagnostics}
          conflicts={conflicts}
          awarenessStates={awarenessStates}
          selections={selections}
          cursorPosition={cursorPosition}
          scrollTop={scrollTop}
          displayLayerRef={displayLayerRef}
          inputLayerRef={inputLayerRef}
          onInputChange={handleInputChange}
          onCursorChange={handleCursorChange}
          selectedFile={selectedFile}
          currentUserId={currentUserId}
          autocomplete={{
            ...autocomplete,
            onSelect: handleAutocompleteSelect,
            onClose: closeAutocomplete,
          }}
          hoverInfo={hoverInfo}
        />
      </EditorScrollContainer>
    </div>
  );
}
