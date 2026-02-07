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
  awarenessStates,
  // diagnostics,
  // conflicts,
  // awarenessStates,
  // selections,
  // currentUserId,
  scrollTop,
  scrollLeft,
}) {
  const lineHeight = 20;
  const charWidth = 8.4; // Monospace character width
  
  return (
    // <div
    //   className="absolute inset-0 overflow-hidden z-30 pointer-events-none"
    //   style={{
    //     lineHeight: `${LINE_HEIGHT}px`,
    //   }}
    // >
    //   {/* Selection Highlights - lowest layer */}
    //   <SelectionHighlights
    //     selections={selections}
    //     scrollTop={scrollTop}
    //   />

    //   {/* Error Squiggles */}
    //   <ErrorSquiggles
    //     diagnostics={diagnostics}
    //     scrollTop={scrollTop}
    //   />

    //   {/* Conflict Markers */}
    //   <ConflictMarkers
    //     conflicts={conflicts}
    //     scrollTop={scrollTop}
    //   />

    //   {/* Collaborative Cursors - top layer */}
    //   <CollaborativeCursors
    //     awarenessStates={awarenessStates}
    //     currentUserId={currentUserId}
    //     scrollTop={scrollTop}
    //   />
    // </div>
 <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ 
        zIndex: 3,
        transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`, // ← BOTH TRANSFORMS
        willChange: "transform",
        transition: "none",
      }}
    >
      {awarenessStates && awarenessStates.map((state) => {
        const { userId, userName, cursor, color = "#FF6B6B" } = state;

        if (!cursor) return null;

        const x = cursor.column * CHAR_WIDTH + 10;
        const y = cursor.line * LINE_HEIGHT + 10;

        return (
          <div
            key={userId}
            className="absolute pointer-events-none"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              height: `${LINE_HEIGHT}px`,
              borderLeft: `2px solid ${color}`,
              zIndex: 10,
            }}
          >
            <div
              className="absolute px-2 py-1 rounded text-xs font-bold whitespace-nowrap pointer-events-none"
              style={{
                top: "-24px",
                left: "0",
                background: color,
                color: "white",
                zIndex: 11,
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
