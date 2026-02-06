import React, { useEffect, useRef, useCallback } from "react";

const LINE_HEIGHT = 20; // pixels
const TAB_SIZE = 4; // spaces
const CHAR_WIDTH = 8.4; // approximate monospace char width in pixels

export default function InputLayer({
  editorContent,
  inputLayerRef,
  onInputChange,
  onCursorChange,
  selectedFile,
}) {
  const internalRef = useRef(null);

  // Forward ref
  useEffect(() => {
    if (inputLayerRef) {
      inputLayerRef.current = internalRef.current;
    }
  }, [inputLayerRef]);

  // Handle input/paste events
  const handleInput = useCallback((e) => {
    const newContent = e.currentTarget.textContent || "";
    onInputChange(newContent);
  }, [onInputChange]);

  // Handle cursor position tracking
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(internalRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    const offset = preCaretRange.toString().length;
    const content = internalRef.current?.textContent || "";
    
    // Calculate line and column from offset
    let line = 0;
    let column = 0;
    let charCount = 0;

    for (let i = 0; i < content.length && i < offset; i++) {
      if (content[i] === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
      charCount++;
    }

    onCursorChange(line, column);
  }, [onCursorChange]);

  // Handle keydown for special keys (Tab, Enter, etc.)
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      insertAtCursor("  ".repeat(TAB_SIZE / 2)); // Insert spaces instead of tab
    }

    if (e.key === "Enter") {
      // Auto-indent: get indentation of current line
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const lineStart = getLineStart(range);
      const lineContent = getLineContent(lineStart, range);
      const indentMatch = lineContent.match(/^\s*/);
      const currentIndent = indentMatch ? indentMatch[0] : "";

      // Let default behavior happen first, then add indent
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection.rangeCount) {
          const range = selection.getRangeAt(0);
          const textNode = range.startContainer;
          const offset = range.startOffset;

          if (textNode.nodeType === Node.TEXT_NODE) {
            const newIndent = document.createTextNode(currentIndent);
            range.insertNode(newIndent);
            range.setStartAfter(newIndent);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }, 0);
    }
  }, []);

  // Helper to insert text at cursor
  const insertAtCursor = (text) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // Trigger input event
    const event = new Event("input", { bubbles: true });
    internalRef.current?.dispatchEvent(event);
  };

  return (
    <div
      ref={internalRef}
      contentEditable="true"
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onMouseUp={handleSelectionChange}
      onKeyUp={handleSelectionChange}
      className="absolute inset-0 overflow-hidden text-slate-200 font-mono text-sm bg-transparent z-20 p-4 outline-none selection:bg-blue-500/40"
      style={{
        opacity: 0.01, // Invisible but interactive
        lineHeight: `${LINE_HEIGHT}px`,
        whiteSpace: "pre-wrap",
        wordWrap: "break-word",
        caretColor: "white",
      }}
      spellCheck="false"
      data-testid="input-layer"
    >
      {editorContent}
    </div>
  );
}

// Helper functions
function getLineStart(range) {
  const container = range.startContainer;
  const newRange = range.cloneRange();
  newRange.selectNodeContents(range.commonAncestorContainer);
  newRange.setEnd(container, range.startOffset);
  return newRange;
}

function getLineContent(range, cursorRange) {
  const content = range.toString();
  const lastNewline = content.lastIndexOf("\n");
  return lastNewline === -1 ? content : content.substring(lastNewline + 1);
}
