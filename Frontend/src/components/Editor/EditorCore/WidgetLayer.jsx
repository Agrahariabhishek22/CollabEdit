// components/Editor/WidgetLayer/index.jsx

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  useTreeSitter,
  getIndentLevelAtCursor,
} from "../../../hooks/useTreeSitter";
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
  onDeltaInsert,
  onSmartIndent,
}) {
  // console.log(
  //   "[Widget layer]Scroll top and Scroll left",
  //   scrollTop,
  //   scrollLeft,
  // );

  const language = detectLanguage(selectedFile?.name);
  const { tree, errors, loading } = useTreeSitter(content, language);
  const { generateSuggestions } = useAutocomplete(
    content,
    tree,
    null,
    language,
  );
  const { getSmartIndent } = useSmartIndent(tree, content);

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [prefixStartIndex, setPrefixStartIndex] = useState(0);

  // 🟢 Monitor input for autocomplete trigger
  useEffect(() => {
    if (!inputLayerRef?.current || loading) return;

    const handleInput = (e) => {
      const textarea = e.target;
      const cursorPos = textarea.selectionStart;

      // 🛠️ FIX: Live DOM values uthao taaki stale props ka issue na ho
      const liveScrollLeft = textarea.scrollLeft;
      const liveScrollTop = textarea.scrollTop;

      const textBeforeCursor = textarea.value.substring(0, cursorPos);
      const lines = textBeforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];

      const wordMatch = currentLine.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
      const prefix = wordMatch ? wordMatch[1] : "";

      if (prefix.length > 1) {
        // Calculate logic for prefix start
        const lineStart = textBeforeCursor.length - currentLine.length;
        const prefixStart = lineStart + (currentLine.length - prefix.length);

        setCurrentPrefix(prefix);
        setPrefixStartIndex(prefixStart);

        // Suggestions generate karo
        const sug = generateSuggestions(prefix, cursorPos);
        setSuggestions(sug);

        // POSITIONING LOGIC
        const charIndex = currentLine.length - prefix.length;

        // x calculation: Char width * index + padding - LIVE scroll
        const x = charIndex * 8.43 + 10 - liveScrollLeft;

        // y calculation: Line number * height + padding + height - LIVE scroll
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
  }, [generateSuggestions, inputLayerRef, loading]); // Stale scrollTop/Left dependency ki zarurat nahi ab

  // 🟢 Handle suggestion selection - SEND ONLY DELTA
  const handleSelectSuggestion = (suggestion) => {
    if (!onDeltaInsert) return;

    console.log(
      `[WidgetLayer] Selected: "${suggestion.text}" to replace prefix "${currentPrefix}"`,
    );

    const textToInsert = suggestion.text.substring(currentPrefix.length);

    if (textToInsert.length === 0) {
      setDropdownVisible(false);
      return;
    }

    onDeltaInsert({
      type: "insert",
      index: prefixStartIndex + currentPrefix.length,
      text: textToInsert,
    });

    setDropdownVisible(false);
    setCurrentPrefix("");
    setPrefixStartIndex(0);
  };

  // 🟢 Handle special keys
  useEffect(() => {
    if (!inputLayerRef?.current || loading) return;

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        // Enter press hone par agar dropdown khula hai toh smart indent ya select trigger ho sakta hai
        // Filhaal smart indent logic:
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
  }, [getSmartIndent, onSmartIndent, inputLayerRef, loading]);

  if (loading) {
    return (
      <div className="absolute top-2 right-2 text-xs text-yellow-400 z-50">
        ⏳ Initializing...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
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
    java: "java",
    py: "python",
  };
  return langMap[ext] || "javascript";
}
