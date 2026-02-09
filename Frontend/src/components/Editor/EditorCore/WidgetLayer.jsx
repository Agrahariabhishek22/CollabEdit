// components/Editor/WidgetLayer/index.jsx

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useTreeSitter, getIndentLevelAtCursor } from "../../../hooks/useTreeSitter";
import { useAutocomplete } from "../../../hooks/useAutoComplete";
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
  onDeltaInsert, // 🟢 New: Accept delta instead of full text
  onSmartIndent,
}) {
  const language = detectLanguage(selectedFile?.name);
  const { tree, errors, loading } = useTreeSitter(content, language);
  const { generateSuggestions } = useAutocomplete(content, tree, null, language);
  const { getSmartIndent } = useSmartIndent(tree, content);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [prefixStartIndex, setPrefixStartIndex] = useState(0); // 🟢 Store where prefix started

  // 🟢 Monitor input for autocomplete trigger
  useEffect(() => {
    if (!inputLayerRef?.current || loading) return;

    const handleInput = (e) => {
      const textarea = e.target;
      const cursorPos = textarea.selectionStart;
      // console.log(textarea.selectionStart, textarea.selectionEnd);
      
      const textBeforeCursor = textarea.value.substring(0, cursorPos);
      const lines = textBeforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];

      // Extract word at cursor
      const wordMatch = currentLine.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
      const prefix = wordMatch ? wordMatch[1] : "";

      if (prefix.length > 1) {
        // Calculate where prefix started in the full content
        const lineStart = textBeforeCursor.length - currentLine.length;
        const prefixStart = lineStart + (currentLine.length - prefix.length);
        
        setCurrentPrefix(prefix);
        setPrefixStartIndex(prefixStart); // 🟢 Store for later use

        // Generate suggestions
        const sug = generateSuggestions(prefix, cursorPos);
        setSuggestions(sug);

        // Position dropdown
        const charIndex = currentLine.length - prefix.length;
        const x = charIndex * 8.43 + 10;
        const y = (lines.length - 1) * 24 + 10 + 24;

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
  }, [generateSuggestions, inputLayerRef, loading]);

  // 🟢 Handle special keys
  useEffect(() => {
    if (!inputLayerRef?.current || loading) return;

    const handleKeyDown = (e) => {
      // Tab: Accept suggestion
      if (e.key === "Tab" && dropdownVisible && suggestions.length > 0) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[0]);
        return;
      }

      // Enter: Smart indent
      if (e.key === "Enter") {
        const textarea = e.target;
        const cursorPos = textarea.selectionStart;
        const indent = getSmartIndent(cursorPos);

        if (onSmartIndent) {
          onSmartIndent(indent);
        }

        setDropdownVisible(false);
        return;
      }

      // Escape: Close dropdown
      if (e.key === "Escape") {
        setDropdownVisible(false);
      }
    };

    inputLayerRef.current.addEventListener("keydown", handleKeyDown);
    return () => {
      inputLayerRef.current?.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    getSmartIndent,
    onSmartIndent,
    inputLayerRef,
    loading,
    dropdownVisible,
    suggestions,
  ]);

  // 🟢 Handle suggestion selection - SEND ONLY DELTA
  const handleSelectSuggestion = (suggestion) => {
    if (!onDeltaInsert) return;

    console.log(
      `[WidgetLayer] Selected: "${suggestion.text}" to replace prefix "${currentPrefix}"`
    );

    // 🟢 Calculate what to insert (suggestion minus the prefix already typed)
    const textToInsert = suggestion.text.substring(currentPrefix.length);

    if (textToInsert.length === 0) {
      console.log("[WidgetLayer] No additional text to insert");
      setDropdownVisible(false);
      return;
    }

    // 🟢 Send delta: Insert only the remaining part of suggestion
    onDeltaInsert({
      type: "insert",
      index: prefixStartIndex + currentPrefix.length, // Position right after prefix
      text: textToInsert,
    });

    console.log(
      `[WidgetLayer] Delta: INSERT "${textToInsert}" at index ${prefixStartIndex + currentPrefix.length}`
    );

    setDropdownVisible(false);
    setCurrentPrefix("");
    setPrefixStartIndex(0);
  };

  if (loading) {
    return (
      <div className="absolute top-2 right-2 text-xs text-yellow-400 z-50">
        ⏳ Initializing...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {/* Autocomplete Dropdown */}
      <div className="pointer-events-auto">
        <SuggestionDropdown
          suggestions={suggestions}
          visible={dropdownVisible}
          position={dropdownPosition}
          onSelect={handleSelectSuggestion}
          onDismiss={() => setDropdownVisible(false)}
        />
      </div>

      {/* Syntax Error Highlights */}
      <SyntaxErrorWidget
        errors={errors}
        scrollTop={scrollTop}
        scrollLeft={scrollLeft}
      />
    </div>
  );
}

function detectLanguage(filename) {
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
  };
  return langMap[ext] || "javascript";
}