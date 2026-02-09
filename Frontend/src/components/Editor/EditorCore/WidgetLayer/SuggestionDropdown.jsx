// components/Editor/WidgetLayer/SuggestionDropdown.jsx

import React, { useState, useEffect } from "react";

export default function SuggestionDropdown({
  suggestions,
  visible,
  position,
  onSelect,
  onDismiss,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, suggestions.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (suggestions.length > 0) {
          onSelect(suggestions[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, suggestions, selectedIndex, onSelect, onDismiss]);

  if (!visible || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bg-slate-800 border border-slate-600 rounded shadow-lg z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: "200px",
        maxWidth: "300px",
        maxHeight: "200px",
        overflowY: "auto",
      }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className={`px-3 py-2 cursor-pointer text-sm font-mono ${
            index === selectedIndex
              ? "bg-blue-600 text-white"
              : "text-slate-200 hover:bg-slate-700"
          }`}
          onClick={() => onSelect(suggestion)}
        >
          <div className="flex justify-between items-center">
            <span>{suggestion.text}</span>
            <span className="text-xs text-slate-400">
              {suggestion.score.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}