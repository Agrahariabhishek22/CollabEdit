import React from "react";
import AutocompleteDropdown from "./AutocompleteDropdown";
import HoverTooltip from "./OverlayLayer/HoverTooltip";

/**
 * WidgetLayer (Layer 4: z-index 40)
 * 
 * Renders interactive widgets on top of all other layers:
 * - Autocomplete dropdown for code suggestions
 * - Hover tooltips with type information from LSP
 * - Line decorations (future: breakpoints, inline hints)
 * Data Flow:
 * WidgetLayer
├── AutocompleteWidget
│   ├── useAutocomplete (Hook - Frequency/Distance scoring)
│   ├── useTreeSitter (Hook - AST parsing)
│   └── SuggestionDropdown (Component)
├── SyntaxErrorWidget
│   ├── useTreeSitterErrors (Hook)
│   └── ErrorHighlight (Component)
└── SmartIndentHandler (Hook - Enter key logic)
 */
export default function WidgetLayer({
  autocomplete,
  hoverInfo,
  cursorPosition,
  scrollTop,
}) {
  return (
    <div className="absolute inset-0 overflow-hidden z-40 pointer-events-none">
      {/* Autocomplete Dropdown */}
      {autocomplete && (
        <AutocompleteDropdown
          isOpen={autocomplete.isOpen}
          suggestions={autocomplete.suggestions}
          selectedIndex={autocomplete.selectedIndex}
          cursorPosition={cursorPosition}
          onSelect={autocomplete.onSelect}
          onClose={autocomplete.onClose}
          scrollTop={scrollTop}
        />
      )}

      {/* Hover Tooltip */}
      {/* {hoverInfo && (
        <HoverTooltip
          isVisible={hoverInfo.isVisible}
          hoverData={hoverInfo.data}
          position={hoverInfo.position}
          scrollTop={scrollTop}
        />
      )} */}
    </div>
  );
}
