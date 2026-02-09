// components/Editor/WidgetLayer/SyntaxErrorWidget.jsx

import React from "react";

const LINE_HEIGHT = 24;
const CHAR_WIDTH = 8.43;

export default function SyntaxErrorWidget({
  errors,
  scrollTop,
  scrollLeft,
}) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 pointer-events-none" style={{ zIndex: 25 }}>
      {errors.map((error, idx) => {
        const x = error.column * CHAR_WIDTH + 10;
        const y = error.line * LINE_HEIGHT + 10;

        return (
          <div
            key={idx}
            className="absolute"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: `translateY(-${scrollTop}px) translateX(-${scrollLeft}px)`,
              willChange: "transform",
              transition: "none",
            }}
          >
            {/* Wavy underline for error */}
            <div
              className="absolute"
              style={{
                borderBottom: "2px wavy #ef4444",
                width: `${(error.endColumn - error.column) * CHAR_WIDTH}px`,
                height: "20px",
              }}
            />

            {/* Error tooltip on hover */}
            <div className="group relative">
              <div
                className="hidden group-hover:block absolute bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                style={{
                  bottom: "25px",
                  left: "0",
                  zIndex: 100,
                }}
              >
                {error.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}