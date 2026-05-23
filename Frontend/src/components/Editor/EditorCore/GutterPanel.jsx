// components/Editor/EditorCore/GutterPanel.jsx

import React, { forwardRef, useMemo } from "react";
import ConflictBadges from "../ConflictBadges"; // ✅ ADD-ON: Conflict badges

const GutterPanel = forwardRef(({ lines, scrollTop, errors, conflicts, onConflictClick }, ref) => {
  const lineHeight = 24;

  // ✅ Step 1: Memoize errors per line for fast lookup
  const errorMap = useMemo(() => {
    const map = new Map();
    if (!errors) return map;
    
    errors.forEach((err) => {
      // Tree-sitter rows are 0-indexed, humne index ko key banaya hai
      // Agar ek line par multiple errors hain, toh "error" ko "warning" se upar rakhenge
      const existing = map.get(err.line);
      if (!existing || (err.severity === "error" && existing.severity !== "error")) {
        map.set(err.line, { 
          message: err.message, 
          severity: err.severity,
          type: err.type 
        });
      }
    });
    return map;
  }, [errors]);

  // ✅ ADD-ON: Memoize conflicts per line for fast lookup
  const conflictMap = useMemo(() => {
    const map = new Map();
    if (!conflicts || conflicts.length === 0) return map;

    conflicts.forEach((conflict) => {
      for (
        let line = conflict.location.startLine;
        line <= conflict.location.endLine;
        line++
      ) {
        if (!map.has(line)) {
          map.set(line, []);
        }
        map.get(line).push(conflict);
      }
    });
    return map;
  }, [conflicts]);

  // ✅ Helper for subtle styling
  const getLineStyle = (lineIndex) => {
    const error = errorMap.get(lineIndex);
    if (!error) return "text-slate-600";

    if (error.severity === "error") {
      return "bg-red-900/30 text-red-400 border-r-2 border-red-500/50";
    }
    if (error.severity === "warning"||error.type === "info") {
      return "bg-amber-900/20 text-amber-400/80 border-r-2 border-amber-500/40";
    }
    return "text-slate-600";
  };

  return (
    <div
      className="w-12 bg-slate-900 select-none overflow-hidden flex-shrink-0 border-r border-slate-800"
      style={{
        minWidth: "48px",
        maxWidth: "48px",
      }}
    >
      <div
        ref={ref}
        style={{
          transform: `translateY(-${scrollTop || 0}px)`,
          willChange: "transform",
          transition: "none",
        }}
        className="flex flex-col pt-[10px]"
      >
        {lines.map((_, index) => {
          const error = errorMap.get(index);
          const lineConflicts = conflictMap.get(index) || []; // ✅ ADD-ON
          
          return (
            <div
              key={index}
              title={error ? `[${error.severity.toUpperCase()}] ${error.message}` : ""}
              className={`h-6 text-[12px] font-mono leading-6 w-full text-right pr-2 transition-colors duration-200 cursor-default relative ${getLineStyle(index)}`}
              style={{
                height: `${lineHeight}px`,
                lineHeight: `${lineHeight}px`,
                flexShrink: 0,
              }}
            >
              {index + 1}
              {/* ✅ ADD-ON: Conflict badges */}
              <ConflictBadges
                conflicts={lineConflicts}
                lineIndex={index}
                onConflictClick={onConflictClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

GutterPanel.displayName = "GutterPanel";

export default GutterPanel;