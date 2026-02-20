// DELTA: components/Editor/WidgetLayer/index.jsx
// Keep existing logic, just update autocomplete hook integration

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  useTreeSitter,
  getIndentLevelAtCursor,
} from "../../../hooks/useTreeSitter";
import { useAutocomplete } from "../../../hooks/useAutoComplete"; // ✅ Updated import
import { useSmartIndent } from "../../../hooks/useSmartIndent";
import SuggestionDropdown from "./WidgetLayer/SuggestionDropdown";
import SyntaxErrorWidget from "./WidgetLayer/SyntaxErrorWidget";

export default function WidgetLayer({
  content,
  scrollTop,
  scrollLeft,
  cursorPosition,
  inputLayerRef,
  selectedFile,
  onDeltaInsert,
  onSmartIndent,
  tree,
  errors,
  loading,
  language,
}) {
  // ============================================================================
  // DELTA 1: Update useAutocomplete hook call
  // ============================================================================

  const validCursorIndex =
    cursorPosition && typeof cursorPosition === "number"
      ? Math.max(0, Math.min(cursorPosition, content.length - 1))
      : 0;

  const { generateSuggestions } = useAutocomplete(
    content,
    tree,
    validCursorIndex, // ✅ Pass valid cursor index
    language,
  );

  const { getSmartIndent } = useSmartIndent(tree, content);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [prefixStartIndex, setPrefixStartIndex] = useState(0);

  // ============================================================================
  // DELTA 2: Update input handler - use new hook's generateSuggestions
  // ============================================================================
  useEffect(() => {
    if (!inputLayerRef?.current || loading) return;

    const handleInput = (e) => {
      const textarea = e.target;
      const cursorPos = textarea.selectionStart;

      const liveScrollLeft = textarea.scrollLeft;
      const liveScrollTop = textarea.scrollTop;

      const textBeforeCursor = textarea.value.substring(0, cursorPos);
      const lines = textBeforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];

      const wordMatch = currentLine.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
      const prefix = wordMatch ? wordMatch[1] : "";

      if (prefix.length > 1) {
        const lineStart = textBeforeCursor.length - currentLine.length;
        const prefixStart = lineStart + (currentLine.length - prefix.length);

        setCurrentPrefix(prefix);
        setPrefixStartIndex(prefixStart);

        // ✅ DELTA: Call new generateSuggestions with proper params
        // New hook returns objects with: { text, score, category, context }
        const sug = generateSuggestions(prefix, cursorPos);
        setSuggestions(sug); // Already returns array of suggestion objects

        const charIndex = currentLine.length - prefix.length;
        const x = charIndex * 8.43 + 10 - liveScrollLeft;
        const y = (lines.length - 1) * 24 + 10 + 24 - liveScrollTop;

        setDropdownPosition({ x, y });
        setDropdownVisible(sug.length > 0);
      } else {
        setDropdownVisible(false);
      }
    };

    inputLayerRef.current.addEventListener("input", handleInput);
    return () => {
      inputLayerRef.current?.removeEventListener("input", handleInput);
    };
  }, [generateSuggestions, inputLayerRef, loading, tree]); // ✅ tree dependency added

  // ============================================================================
  // DELTA 3: Handle suggestion selection - same logic, works with new hook
  // ============================================================================
  const handleSelectSuggestion = (suggestion) => {
    if (!onDeltaInsert) return;

    // ✅ New hook returns suggestion.text directly
    const textToInsert = suggestion.text.substring(currentPrefix.length);

    if (textToInsert.length === 0) {
      setDropdownVisible(false);
      return;
    }

    console.log(
      `[WidgetLayer] Selected: "${suggestion.text}" (${suggestion.category}) to replace prefix "${currentPrefix}"`,
    );

    onDeltaInsert({
      type: "insert",
      index: prefixStartIndex + currentPrefix.length,
      text: textToInsert,
    });

    setDropdownVisible(false);
    setCurrentPrefix("");
    setPrefixStartIndex(0);
  };

  // ============================================================================
  // DELTA 4: Handle Enter key - same logic
  // ============================================================================
  useEffect(() => {
    if (!inputLayerRef?.current || loading || !tree) return;

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        const textarea = e.target;
        const cursorPos = textarea.selectionStart;

        const indent = getSmartIndent(cursorPos);

        if (onSmartIndent) {
          e.preventDefault();
          onSmartIndent(indent);
        }
        setDropdownVisible(false);
      }
    };

    inputLayerRef.current.addEventListener("keydown", handleKeyDown);
    return () => {
      inputLayerRef.current?.removeEventListener("keydown", handleKeyDown);
    };
}, [inputLayerRef, loading, tree]);

  if (loading) {
    return (
      <div className="absolute top-2 right-2 text-xs text-yellow-400 z-50">
        ⏳ Parsing...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40 ">
      <div className="pointer-events-auto">
        <SuggestionDropdown
          suggestions={suggestions}
          scrollTop={scrollTop}
          scrollLeft={scrollLeft}
          visible={dropdownVisible}
          position={dropdownPosition}
          onSelect={handleSelectSuggestion}
          onDismiss={() => setDropdownVisible(false)}
        />
      </div>

      <SyntaxErrorWidget
        errors={errors}
        scrollTop={scrollTop}
        scrollLeft={scrollLeft}
      />
    </div>
  );
}

export function detectLanguage(filename) {
  if (!filename) return "javascript";
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "cpp",
    h: "cpp",
    hpp: "cpp",
    java: "java",
    py: "python",
  };
  return langMap[ext] || "javascript";
}
