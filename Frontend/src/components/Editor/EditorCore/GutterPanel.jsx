// components/Editor/EditorCore/GutterPanel.jsx

import React, { forwardRef } from "react";

const GutterPanel = forwardRef(({ lines, scrollTop }, ref) => {
  const lineHeight = 24; // Must match editor line height

  return (
    <div 
      className="w-12 bg-slate-900 text-slate-600 select-none overflow-hidden flex-shrink-0 border-r border-slate-800"
      style={{
        minWidth: "48px",
        maxWidth: "48px",
      }}
    >
      {/* Inner container that moves with scroll */}
      <div
        ref={ref}
        style={{ 
          transform: `translateY(-${scrollTop || 0}px)`,
          willChange: "transform",
          transition: "none", // No transition for scroll - must be instant
        }}
        className="flex flex-col items-end pr-3 pt-[10px]"
      >
        {lines.map((_, index) => (
          <div
            key={index}
            className="h-6 text-[14px] font-mono leading-6 w-full text-right pr-2"
            style={{ 
              height: `${lineHeight}px`,
              lineHeight: `${lineHeight}px`,
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
});

GutterPanel.displayName = "GutterPanel";

export default GutterPanel;
