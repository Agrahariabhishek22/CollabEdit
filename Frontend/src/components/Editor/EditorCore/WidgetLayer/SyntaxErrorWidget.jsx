import React from "react";

const LINE_HEIGHT = 24;
const CHAR_WIDTH = 8.43;

export default function SyntaxErrorWidget({ errors, scrollTop, scrollLeft }) {
  if (!errors || errors.length === 0) return null;
console.log(errors);

  return (
    <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 25 }}>
      {errors.map((error, idx) => {
        // 1. Calculate base position
        const x = error.column * CHAR_WIDTH + 10;
        const y = error.line * LINE_HEIGHT + 10;

        // 2. Fix: Ensure width is at least one character
        const errorWidth = Math.max(
          (error.endColumn - error.column) * CHAR_WIDTH, 
          CHAR_WIDTH
        );

        return (
          <div
            key={idx}
            className="absolute pointer-events-auto group" // 🟢 Hover enable karne ke liye
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${errorWidth}px`,
              // color: "white", // Transparent so only caret shows
              height: `${LINE_HEIGHT}px`,
              transform: `translate(-${scrollLeft}px, -${scrollTop}px)`,
              willChange: "transform",
            }}
          >
            {/* Wavy Underline */}
            <div
              className="absolute bottom-0 left-0 border-b-2 border-red-500 border-dashed w-full"
              style={{
                height: "4px",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 2 Q 1.5 0, 3 2 T 6 2' fill='none' stroke='%23ef4444' stroke-width='2'/%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat-x",
                border: "none"
              }}
            />

            {/* Tooltip */}
            <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-[100]">
              {error.message}
              {/* Arrow */}
              <div className="absolute top-full left-2 border-4 border-transparent border-t-red-600" />
            </div>
          </div>
        );
      })}
    </div>
  );
}