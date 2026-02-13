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
  const itemsRef = useRef([]); // Track item refs for scrolling

  // Handle click outside - Properly implemented
  useEffect(() => {
    if (!visible) return; // Agar visible nahi hai to listener mat lagao

    const handleClickOutside = (event) => {
      // Dropdown ke bahar click hua to dismiss karo
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onDismiss();
      }
    };

    // Slight delay taaki click event properly propagate ho
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visible, onDismiss]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
    itemsRef.current = []; // Reset refs
  }, [suggestions]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current && itemsRef.current[selectedIndex]) {
      const container = dropdownRef.current;
      const selectedItem = itemsRef.current[selectedIndex];

      if (selectedItem) {
        const containerHeight = container.clientHeight;
        const containerScrollTop = container.scrollTop;
        const itemTop = selectedItem.offsetTop;
        const itemHeight = selectedItem.offsetHeight;

        // Agar item neeche ja raha hai container ke bottom se
        if (itemTop + itemHeight > containerScrollTop + containerHeight) {
          container.scrollTop = itemTop + itemHeight - containerHeight;
        }
        // Agar item upar ja raha hai container ke top se
        else if (itemTop < containerScrollTop) {
          container.scrollTop = itemTop;
        }
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      const navigationKeys = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];
      
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation(); // Editor ke paas jaane se rokho
      }

      if (e.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        setSelectedIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
          onDismiss(); // Selection ke baad dropdown close karo
        }
      } else if (e.key === "Escape") {
        onDismiss();
      }
    };

    // Capture phase use karein taaki dropdown editor se pehle key pakad le
    window.addEventListener("keydown", handleKeyDown, true);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [visible, suggestions, selectedIndex, onSelect, onDismiss]);

  if (!visible || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute bg-slate-800 border border-slate-600 rounded shadow-lg z-50 overflow-y-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
        willChange: "transform",
        minWidth: "200px",
        maxWidth: "300px",
        maxHeight: "200px",
      }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          ref={(el) => (itemsRef.current[index] = el)} // Store item ref
          className={`px-3 py-2 cursor-pointer text-sm font-mono transition-colors ${
            index === selectedIndex
              ? "bg-blue-600 text-white"
              : "text-slate-200 hover:bg-slate-700"
          }`}
          style={{
            willChange:"transform"
          }}
          onClick={() => {
            onSelect(suggestion);
            onDismiss(); // Click ke baad dropdown close karo
          }}
        >
          <div className="flex justify-between items-center gap-2">
            <span className="truncate">{suggestion.text}</span>
            <span className="text-xs text-slate-400 flex-shrink-0">
              {suggestion.score.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}