// components/Editor/EditorCore/InputLayer.jsx

import React, { forwardRef, useRef, useEffect } from "react";

const InputLayer = forwardRef(
  ({ content, onChange, onCursorChange, isReadOnly, scrollTop ,scrollLeft,}, ref) => {
    const textareaRef = useRef(null);
    const lastContentRef = useRef(content);

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

    const handleChange = (e) => {
      const newContent = e.target.value;
      lastContentRef.current = newContent;
      onChange(newContent);
      updateCursorPosition();
    };

    const updateCursorPosition = () => {
      if (!textareaRef.current) return;
      const cursorOffset = textareaRef.current.selectionStart;
      const textBeforeCursor = textareaRef.current.value.substring(0, cursorOffset);
      const lines = textBeforeCursor.split("\n");
      const line = lines.length - 1;
      const column = lines[lines.length - 1].length;
      onCursorChange(line, column);
    };

    const handleCursorEvent = () => {
      updateCursorPosition();
    };

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
          color: "transparent", // ← Transparent for text
          caretColor: "white",
          opacity: 1,
          zIndex: 2,
          overflow: "hidden",
          height: `${totalHeight}px`,
          transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`, // ← BOTH TRANSFORMS
          willChange: "transform",
          transition: "none",
          top: 0,
          left: 0,
          right: 0,
          bottom: "auto",
          width: "4000px",
          whiteSpace: "pre", // ← NO WRAP - exact like DisplayLayer
          margin: 0,
          resize: "none",
          wrap: "off", // ← Explicitly disable wrapping
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