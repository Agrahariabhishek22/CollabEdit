// components/Editor/WidgetLayer/SuggestionDropdown.jsx

import React, { useState, useEffect, useRef } from "react";

export default function SuggestionDropdown({
  suggestions,
  visible,
  position,
  onSelect,
  scrollTop,
  scrollLeft,
  onDismiss,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      // 🟢 Sabse pehle dropdown ki keys ko block karo taaki editor interfere na kare
      const navigationKeys = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];
      if (navigationKeys.includes(e.key)) {
        // e.stopImmediatePropagation(); // Zarurat pade toh use karein
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length); // Loop back to start
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        ); // Loop to end
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };

    // 🟢 'capture' phase use karein taaki dropdown editor se pehle key pakad le
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [visible, suggestions, selectedIndex, onSelect, onDismiss]);

  if (!visible || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bg-slate-800 border border-slate-600 rounded shadow-lg z-50"
      style={{
        left: `${position.x - scrollLeft}px`,
        top: `${position.y - scrollTop}px`,
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
