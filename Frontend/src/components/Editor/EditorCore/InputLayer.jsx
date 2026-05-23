// DELTA: InputLayer.jsx - Auto-Closing Integration

import React, { forwardRef, useRef, useEffect } from "react";
import { useState } from "react";
import { useTreeSitter } from "../../../hooks/useTreeSitter.js";
import { useAutoClosing } from "../../../hooks/useAutoClosing"; // ✅ NEW IMPORT
import { debugTree } from "../../../utils/treeDebugger";

const InputLayer = forwardRef(
  (
    { content, onChange, onCursorChange, isReadOnly, onTreeUpdate, language },
    ref,
  ) => {
    const textareaRef = useRef(null);
    const lastContentRef = useRef(content);
    const [editParams, setEditParams] = useState(null);

    const { tree, errors, loading } = useTreeSitter(
      content,
      language,
      editParams,
    );

    // ✅ DELTA 1: Add auto-closing hook
    const { handleAutoClosing, insertAutoClosingPair } = useAutoClosing(
      tree,
      content,
    );

    useEffect(() => {
      if (onTreeUpdate) {
        onTreeUpdate({ tree, errors, loading });
      }
      // debugTree(tree,content);
    }, [tree, errors, loading, onTreeUpdate]);

    const lineCount = content ? content.split("\n").length : 1;
    const lineHeight = 24;
    const totalHeight = lineCount * lineHeight + 20;

    useEffect(() => {
      if (!textareaRef.current) return;
      if (content !== lastContentRef.current) {
        const cursorPos = textareaRef.current.selectionStart;
        textareaRef.current.value = content;
        lastContentRef.current = content;
        const validPos = Math.min(cursorPos, content.length);
        textareaRef.current.setSelectionRange(validPos, validPos);
      }
    }, [content]);

    // 🟢 Helper to get Row/Column from index
    const getPos = (text, offset) => {
      const lines = text.substring(0, offset).split("\n");
      return { row: lines.length - 1, column: lines[lines.length - 1].length };
    };

    // ============================================================================
    // DELTA 2: Updated handleChange with auto-closing
    // ============================================================================
    const handleChange = (e) => {
      const newContent = e.target.value;
      const oldContent = lastContentRef.current;
      const cursorPos = e.target.selectionStart;

      if (newContent === oldContent) {
        updateCursorPosition();
        return;
      }

      // 🟢 DIFFING ALGORITHM (Same as before)
      let startIndex = 0;
      while (
        startIndex < oldContent.length &&
        startIndex < newContent.length &&
        oldContent[startIndex] === newContent[startIndex]
      ) {
        startIndex++;
      }

      let endIndex = 0;
      while (
        endIndex < oldContent.length - startIndex &&
        endIndex < newContent.length - startIndex &&
        oldContent[oldContent.length - 1 - endIndex] ===
          newContent[newContent.length - 1 - endIndex]
      ) {
        endIndex++;
      }

      const deleteLength = oldContent.length - startIndex - endIndex;
      const insertedText = newContent.substring(
        startIndex,
        newContent.length - endIndex,
      );

      // ✅ DELTA 3: Check if last character is an opening pair
      const lastChar = insertedText[insertedText.length - 1];
      let autoCloseDeltas = [];

      if (insertedText.length === 1 && lastChar) {
        // ✅ Single character insertion - check for auto-closing
        const closingInfo = handleAutoClosing(lastChar, cursorPos, 0, 0);

        if (closingInfo) {
          console.log(`[AutoClose] Triggered for "${lastChar}"`);

          // ✅ Determine if we should add newline
          const shouldAddNewline =
            lastChar === "{" &&
            (newContent[cursorPos] === "" ||
              newContent[cursorPos] === "\n" ||
              newContent[cursorPos] === "}");

          // Get deltas for auto-closing insertion
          autoCloseDeltas = insertAutoClosingPair(
            lastChar,
            closingInfo.closingChar,
            cursorPos,
            shouldAddNewline,
          );

          console.log(`[AutoClose] Generated ${autoCloseDeltas.length} deltas`);
        }
      }

      // 🟢 TREE-SITTER EDIT PARAMS (Same as before)
      const editParams = {
        startIndex,
        oldEndIndex: startIndex + deleteLength,
        newEndIndex: startIndex + insertedText.length,
        startPosition: getPos(oldContent, startIndex),
        oldEndPosition: getPos(oldContent, startIndex + deleteLength),
        newEndPosition: getPos(newContent, startIndex + insertedText.length),
      };
      setEditParams(editParams);

      // 🟢 SEND TO EDITOR CORE (Same as before)
      if (deleteLength > 0) {
        onChange({
          type: "delete",
          index: startIndex,
          length: deleteLength,
        });
      }

      if (insertedText.length > 0) {
        onChange({
          type: "insert",
          index: startIndex,
          text: insertedText,
        });
      }

      // ✅ DELTA 4: Send auto-closing deltas
      // These are sent AFTER the main insert
      autoCloseDeltas.forEach((delta) => {
        console.log(
          `[AutoClose] Sending delta: insert "${delta.text}" at ${delta.index}`,
        );
        onChange(delta);
      });

      lastContentRef.current = newContent;
      updateCursorPosition();

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          // ✅ DELTA 5: Adjust cursor position if auto-close added text
          let finalCursorPos = cursorPos;
          if (autoCloseDeltas.length > 0) {
            // Cursor stays where user typed, before closing pair
            finalCursorPos = cursorPos;
          }
          textareaRef.current.setSelectionRange(finalCursorPos, finalCursorPos);
        }
      });
    };

    // When tab key is pressed space is maintained and cursor is moved forward by 2 spaces
    const handleKeyDown = (e) => {
      // 1. Check karo ki kya "Tab" key dabayi gayi hai
      if (e.key === "Tab") {
        // Browser ka default focus change behavior roko
        e.preventDefault();

        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart, selectionEnd } = textarea;
        const tabSpace = "  "; // Hum 2 spaces use kar rahe hain code editor feel ke liye

        // 2. State Sync: Parent ko batao ki humne Tab insert kiya hai
        // Isse Yjs aur Tree-sitter update ho jayenge
        onChange({
          type: "insert",
          index: selectionStart,
          text: tabSpace,
        });

        // 3. Local UI Update: Textarea ki value manual update karo
        // taaki defaultValue/useEffect cycle wait na karna pade
        const newValue =
          textarea.value.substring(0, selectionStart) +
          tabSpace +
          textarea.value.substring(selectionEnd);

        textarea.value = newValue;
        lastContentRef.current = newValue;

        // 4. Cursor Management: Cursor ko spaces ke aage set karo
        const newPos = selectionStart + tabSpace.length;
        textarea.setSelectionRange(newPos, newPos);

        // Gutter aur Display layers ko update karne ke liye cursor change trigger karo
        updateCursorPosition();
      }
    };
    const updateCursorPosition = () => {
      if (!textareaRef.current) return;
      const cursorOffset = textareaRef.current.selectionStart;
      const textBeforeCursor = textareaRef.current.value.substring(
        0,
        cursorOffset,
      );
      const lines = textBeforeCursor.split("\n");
      const line = lines.length - 1;
      const column = lines[lines.length - 1].length;
      onCursorChange(line, column);
    };

    const handleCursorEvent = () => updateCursorPosition();

    return (
      <textarea
        ref={(el) => {
          textareaRef.current = el;
          if (ref) ref.current = el;
        }}
        className="absolute inset-0 resize-none outline-none bg-transparent "
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: "14px",
          lineHeight: "24px",
          padding: "10px",
          border: "none",
          outline: "none",
          boxSizing: "border-box",
          WebkitFontSmoothing: "antialiased",
          textRendering: "optimizeLegibility",
          color: "transparent",
          caretColor: "white",
          opacity: 1,
          zIndex: 2,
          overflow: "hidden",
          height: `${totalHeight}px`,
          willChange: "transform",
          transition: "none",
          top: 0,
          left: 0,
          right: 0,
          bottom: "auto",
          width: "min-w-full%",
          whiteSpace: "pre",
          margin: 0,
          resize: "none",
          wrap: "off",
        }}
        defaultValue={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown} // ✅ Yahan integrate kar diya
        onKeyUp={handleCursorEvent}
        onClick={handleCursorEvent}
        onMouseUp={handleCursorEvent}
        readOnly={isReadOnly}
        spellCheck={false}
        wrap="off"
      />
    );
  },
);

InputLayer.displayName = "InputLayer";

export default InputLayer;
