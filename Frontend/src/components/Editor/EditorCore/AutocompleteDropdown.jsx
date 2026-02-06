import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown } from "lucide-react";

const CHAR_WIDTH = 8.4;
const LINE_HEIGHT = 20;

/**
 * AutocompleteDropdown Component
 * 
 * Intelligent code completion with scoring system
 * 
 * Data Flow:
 * 1. User types or presses Tab
 * 2. Check if autocomplete should trigger:
 *    - Is cursor after a word boundary?
 *    - Is prefix >= 2 chars?
 * 3. Get suggestions from 3 sources:
 *    - Keywords (const, let, function, etc.)
 *    - Tree-sitter identifiers (from current file AST)
 *    - Recently used identifiers (from Yjs history)
 * 4. Score each suggestion:
 *    - Frequency: How many times used in file?
 *    - Distance: How far from current cursor?
 *    - Score = frequency * (1 / distance)
 * 5. Sort by score (descending)
 * 6. Show dropdown at cursor position
 * 7. Navigate with Arrow keys, select with Enter/Tab
 * 8. Insert into text via yText
 */
export default function AutocompleteDropdown({
  isOpen,
  suggestions,
  selectedIndex,
  cursorPosition,
  onSelect,
  onClose,
  scrollTop,
}) {
  const dropdownRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // Calculate dropdown position
  const x = cursorPosition.column * CHAR_WIDTH + 64; // 64px for gutter
  const y = cursorPosition.line * LINE_HEIGHT - scrollTop + LINE_HEIGHT + 5;

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const itemElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (itemElement) {
        itemElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || suggestions.length === 0) {
    return null;
  }

  // Get snippet preview (show type/description)
  const getSnippetPreview = (suggestion) => {
    if (suggestion.type === "keyword") {
      return "Keyword";
    }
    if (suggestion.type === "function") {
      return "Function";
    }
    if (suggestion.type === "variable") {
      return "Variable";
    }
    return suggestion.description || "";
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 overflow-hidden"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: "300px",
        maxHeight: "200px",
        overflowY: "auto",
      }}
    >
      {suggestions.slice(0, 10).map((suggestion, index) => (
        <div
          key={`${suggestion.label}-${index}`}
          data-index={index}
          onClick={() => onSelect(suggestion)}
          className={`px-4 py-2 cursor-pointer transition-colors flex items-center gap-3 ${
            selectedIndex === index
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          {/* Icon based on type */}
          <span className="text-sm">
            {suggestion.type === "keyword" && "🔑"}
            {suggestion.type === "function" && "ƒ"}
            {suggestion.type === "variable" && "𝑣"}
            {suggestion.type === "class" && "𝐶"}
            {!suggestion.type && "•"}
          </span>

          {/* Label and preview */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {suggestion.label}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {getSnippetPreview(suggestion)}
            </div>
          </div>

          {/* Score indicator (hidden, for debugging) */}
          <div className="text-xs text-slate-500">
            {suggestion.score?.toFixed(1) || ""}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {suggestions.length === 0 && (
        <div className="px-4 py-3 text-slate-400 text-sm text-center">
          No suggestions
        </div>
      )}
    </div>
  );
}
