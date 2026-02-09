// CollaborativeCursors.jsx - Update करो

import React, { useEffect, useState } from "react";

const USER_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
];

const CHAR_WIDTH = 8.43;    // ← OverlayLayer जैसा
const LINE_HEIGHT = 24;     // ← OverlayLayer जैसा
const PADDING_OFFSET = 10;  // ← OverlayLayer जैसा

export default function CollaborativeCursors({
  awarenessStates,
  currentUserId,
  scrollTop,
  scrollLeft,
}) {
  if (!awarenessStates || awarenessStates.length === 0) {
    return null;
  }

  return (
    <>
      {awarenessStates.map((state) => {
        const { userId, userName, cursor, color = "#FF6B6B" } = state;

        // Current user का cursor skip कर
        // if (!cursor || userId === currentUserId) return null;

        // Position calculation - OverlayLayer जैसा
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
                top: "-18px",
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

      {/* Blinking animation */}
      <style>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}