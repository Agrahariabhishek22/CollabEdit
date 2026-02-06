import React, { useMemo } from "react";
import { AlertCircle } from "lucide-react";

const LINE_HEIGHT = 20; // pixels, must match CSS
const GUTTER_WIDTH = 50; // pixels for line numbers

export default function GutterPanel({ lines, diagnostics, scrollTop }) {
  const visibleLines = useMemo(() => {
    return lines.map((_, index) => index + 1);
  }, [lines]);

  // Map diagnostics by line number for quick lookup
  const diagnosticsByLine = useMemo(() => {
    const map = {};
    diagnostics.forEach((diag) => {
      const line = diag.range?.start?.line || 0;
      if (!map[line]) {
        map[line] = [];
      }
      map[line].push(diag);
    });
    return map;
  }, [diagnostics]);

  // Get severity color for error icon
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "error":
        return "text-red-500";
      case "warning":
        return "text-amber-500";
      case "information":
        return "text-blue-500";
      default:
        return "text-slate-500";
    }
  };

  return (
    <div
      className="flex items-start bg-slate-900 border-r border-slate-800 select-none overflow-hidden"
      style={{
        width: GUTTER_WIDTH,
        height: "100%",
      }}
    >
      <div
        className="flex flex-col w-full"
        style={{
          paddingTop: `${-scrollTop}px`,
        }}
      >
        {visibleLines.map((lineNum) => {
          const hasDiagnostic = diagnosticsByLine[lineNum - 1];

          return (
            <div
              key={lineNum}
              className="flex items-center justify-between px-2 text-slate-500 text-xs font-mono"
              style={{
                height: LINE_HEIGHT,
                lineHeight: `${LINE_HEIGHT}px`,
              }}
            >
              {/* Line Number */}
              <span className="text-right flex-1">{lineNum}</span>

              {/* Error/Warning Icon */}
              {hasDiagnostic && (
                <div
                  className={`ml-1 flex-shrink-0 relative group cursor-pointer`}
                  title={hasDiagnostic[0]?.message}
                >
                  <AlertCircle
                    size={14}
                    className={getSeverityColor(hasDiagnostic[0]?.severity)}
                  />

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-800 text-slate-100 text-xs p-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
                    {hasDiagnostic[0]?.message}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
