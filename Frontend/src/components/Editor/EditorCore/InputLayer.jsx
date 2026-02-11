// components/Editor/EditorCore/InputLayer.jsx

import React, { forwardRef, useRef, useEffect } from "react";

const InputLayer = forwardRef(
  (
    { content, onChange, onCursorChange, isReadOnly,onTreeUpdate, language, scrollTop, scrollLeft },
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

    useEffect(() => {
      if (onTreeUpdate) {
        onTreeUpdate({ tree, errors, loading });
      }
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

    const handleChange = (e) => {
      const newContent = e.target.value;
      const oldContent = lastContentRef.current;
      const cursorPos = e.target.selectionStart;

      if (newContent === oldContent) {
        updateCursorPosition();
        return;
      }

      // 🟢 DIFFING ALGORITHM
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

      // 🟢 TREE-SITTER EDIT PARAMS CALCULATION
      // Inhe generate karna incremental update ke liye zaroori hai
      const editParams = {
        startIndex,
        oldEndIndex: startIndex + deleteLength,
        newEndIndex: startIndex + insertedText.length,
        startPosition: getPos(oldContent, startIndex),
        oldEndPosition: getPos(oldContent, startIndex + deleteLength),
        newEndPosition: getPos(newContent, startIndex + insertedText.length),
      };
      setEditParams(editParams);

      // 🟢 SEND TO EDITOR CORE
      // Hum dono bhej rahe hain: Yjs delta aur Tree-sitter params
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

      lastContentRef.current = newContent;
      updateCursorPosition();

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(cursorPos, cursorPos);
        }
      });
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
        className="absolute inset-0 resize-none outline-none bg-transparent"
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
          color: "transparent", // Transparent so only caret shows
          caretColor: "transparent",
          opacity: 1,
          zIndex: 2,
          overflow: "hidden",
          height: `${totalHeight}px`,
          transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`,
          willChange: "transform",
          transition: "none",
          top: 0,
          left: 0,
          right: 0,
          bottom: "auto",
          width: "4000px",
          whiteSpace: "pre",
          margin: 0,
          resize: "none",
          wrap: "off",
        }}
        value={content}
        onChange={handleChange}
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
