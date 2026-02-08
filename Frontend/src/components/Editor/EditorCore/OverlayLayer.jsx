import React from "react";
import CollaborativeCursors from "./CollaborativeCursors";
import ErrorSquiggles from "./ErrorSquiggles";
import ConflictMarkers from "./ConflictMarkers";
import SelectionHighlights from "./SelectionHighlights";

// DisplayLayer se sync karne ke liye constants
const LINE_HEIGHT = 24; 
const CHAR_WIDTH = 8.43; // Fira Code 14px ke liye accurate width
const PADDING_OFFSET = 10; // Jo padding tune DisplayLayer mein di hai

/**
 * OverlayLayer (Layer 3: z-index 30)
 */
export default function OverlayLayer({
  awarenessStates,
  scrollTop,
  scrollLeft,
  // currentUserId, // Taaki apna cursor yahan render na ho (kyunki wo textarea handle karta hai)
}) {
  
  return (
    <div
      className="absolute top-0 left-0 pointer-events-none overflow-hidden"
      style={{ 
        zIndex: 30, // Textarea (2) ke upar aur DisplayLayer (0) ke upar
        fontFamily: "'Fira Code', monospace",
        fontSize: "14px",
        transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`,
        willChange: "transform",
        transition: "none",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "4000px" // DisplayLayer ki width se match
      }}
    >
      {awarenessStates && awarenessStates.map((state) => {
        const { userId, userName, cursor, color = "#FF6B6B" } = state;

        // 1. Agar cursor data nahi hai ya ye Current User ka cursor hai toh render mat karo
        // if (!cursor || userId === currentUserId) return null;

        // 2. Exact Position Calculation
        // Padding (10px) add karna zaroori hai kyunki DisplayLayer mein padding: 10px hai
        const x = cursor.column * CHAR_WIDTH + PADDING_OFFSET;
        const y = cursor.line * LINE_HEIGHT + PADDING_OFFSET;

        return (
          <div
            key={userId}
            className="absolute pointer-events-none transition-all duration-75 ease-out"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              height: `${LINE_HEIGHT}px`,
              borderLeft: `2px solid ${color}`,
              zIndex: 10,
            }}
          >
            {/* User Label Tag */}
            <div
              className="absolute px-1.5 py-0.5 rounded-sm text-[10px] font-medium animate-in fade-in duration-300"
              style={{
                top: "-18px", // Cursor ke thoda upar
                left: "-2px",
                background: color,
                color: "white",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            >
              {userName || "Anonymous"}
            </div>
          </div>
        );
      })}

      {/* Baki components ko bhi future mein use karne ke liye 
        Inko parameters pass karte waqt padding ka dhyan rakhna hoga
      */}
      {/* <SelectionHighlights selections={selections} /> */}
      {/* <ErrorSquiggles diagnostics={diagnostics} /> */}
    </div>
  );
}