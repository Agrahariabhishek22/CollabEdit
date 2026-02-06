import React from "react";
import CollaborativeCursors from "./CollaborativeCursors";
import ErrorSquiggles from "./ErrorSquiggles";
import ConflictMarkers from "./ConflictMarkers";
import SelectionHighlights from "./SelectionHighlights";

const LINE_HEIGHT = 20;

/**
 * OverlayLayer (Layer 3: z-index 30)
 * 
 * Renders all overlay elements on top of DisplayLayer and InputLayer:
 * - Collaborative cursors from other users (Awareness)
 * - Error squiggles from LSP diagnostics
 * - Conflict markers for merge conflicts
 * - Selection highlights from other users
 */
export default function OverlayLayer({
  diagnostics,
  conflicts,
  awarenessStates,
  selections,
  currentUserId,
  scrollTop,
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden z-30 pointer-events-none"
      style={{
        lineHeight: `${LINE_HEIGHT}px`,
      }}
    >
      {/* Selection Highlights - lowest layer */}
      <SelectionHighlights
        selections={selections}
        scrollTop={scrollTop}
      />

      {/* Error Squiggles */}
      <ErrorSquiggles
        diagnostics={diagnostics}
        scrollTop={scrollTop}
      />

      {/* Conflict Markers */}
      <ConflictMarkers
        conflicts={conflicts}
        scrollTop={scrollTop}
      />

      {/* Collaborative Cursors - top layer */}
      <CollaborativeCursors
        awarenessStates={awarenessStates}
        currentUserId={currentUserId}
        scrollTop={scrollTop}
      />
    </div>
  );
}
