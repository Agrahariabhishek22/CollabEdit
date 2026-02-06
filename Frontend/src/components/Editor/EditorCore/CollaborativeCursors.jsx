import React, { useEffect, useState, useCallback } from "react";
import { useSocket } from "../../../hooks/useSocket";

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

const CHAR_WIDTH = 8.4; // Monospace character width in pixels
const LINE_HEIGHT = 20; // Must match CSS

/**
 * CollaborativeCursors Component
 * 
 * Displays real-time cursors of all collaborators using Yjs Awareness
 * 
 * Data Flow:
 * 1. Listen to awareness.on('change')
 * 2. Get cursor position { line, column, color, name }
 * 3. Calculate pixel position: x = column * CHAR_WIDTH, y = line * LINE_HEIGHT
 * 4. Render cursor div with floating label
 * 5. Update on awareness changes (new cursor position)
 */
export default function CollaborativeCursors({
  awarenessStates,
  currentUserId,
  scrollTop,
}) {
  const [cursors, setCursors] = useState([]);

  // Update cursors when awareness states change
  useEffect(() => {
    if (!awarenessStates || awarenessStates.length === 0) {
      setCursors([]);
      return;
    }

    const newCursors = awarenessStates
      .filter((state) => state.user.clientID !== currentUserId && state.cursor)
      .map((state, index) => ({
        id: state.user.clientID,
        name: state.user.name || `User ${index + 1}`,
        email: state.user.email || "Anonymous",
        color: USER_COLORS[index % USER_COLORS.length],
        cursor: state.cursor,
      }));

    setCursors(newCursors);
  }, [awarenessStates, currentUserId]);

  return (
    <>
      {cursors.map((cursor) => {
        // Calculate pixel position
        const x = cursor.cursor.column * CHAR_WIDTH;
        const y = cursor.cursor.line * LINE_HEIGHT - scrollTop;

        // Skip if cursor is off-screen
        if (y < -50 || y > window.innerHeight + 50) {
          return null;
        }

        return (
          <div
            key={cursor.id}
            className="absolute pointer-events-none z-40"
            style={{
              left: `${x}px`,
              top: `${y + 16}px`, // 16px offset for padding
              transform: "translateX(-2px)",
            }}
          >
            {/* Cursor line */}
            <div
              className="w-0.5 h-5 absolute"
              style={{
                backgroundColor: cursor.color,
                boxShadow: `0 0 3px ${cursor.color}`,
                animation: "blink 1s infinite",
              }}
            />

            {/* Name label */}
            <div
              className="absolute top-full mt-1 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{
                backgroundColor: cursor.color,
                left: "-8px",
              }}
              title={cursor.email}
            >
              {cursor.name}
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
