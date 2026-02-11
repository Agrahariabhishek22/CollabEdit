import React, { useMemo } from "react";

/**
 * DiffViewer Component
 * Displays git diff in a styled format similar to GitHub
 *
 * Features:
 * - Added lines (green)
 * - Removed lines (red)
 * - Context lines (gray)
 * - Line numbers
 * - File path headers
 */
export default function DiffViewer({ diff, maxLines = 100 }) {
  // Parse diff output
  const parsedDiff = useMemo(() => {
    if (!diff) return [];

    const lines = diff.split("\n");
    const parsedLines = [];
    let currentFile = null;

    lines.forEach((line) => {
      // File headers: diff --git a/path b/path
      if (line.startsWith("diff --git")) {
        const match = line.match(/b\/(.+)$/);
        currentFile = match ? match[1] : "unknown";
      }

      // Index line: index abc123..def456 100644
      if (line.startsWith("index ")) {
        return;
      }

      // Added line: starts with '+'
      if (line.startsWith("+") && !line.startsWith("+++")) {
        parsedLines.push({
          type: "add",
          content: line.substring(1),
          file: currentFile,
        });
      }
      // Removed line: starts with '-'
      else if (line.startsWith("-") && !line.startsWith("---")) {
        parsedLines.push({
          type: "remove",
          content: line.substring(1),
          file: currentFile,
        });
      }
      // Context line
      else if (line.startsWith(" ")) {
        parsedLines.push({
          type: "context",
          content: line.substring(1),
          file: currentFile,
        });
      }
      // Hunk header: @@ -10,5 +15,8 @@
      else if (line.startsWith("@@")) {
        parsedLines.push({
          type: "hunk",
          content: line,
          file: currentFile,
        });
      }
    });

    return parsedLines.slice(0, maxLines);
  }, [diff, maxLines]);

  if (!diff) {
    return (
      <div className="p-4 text-slate-400 text-center">No diff available</div>
    );
  }

  return (
    <div className="bg-slate-950 rounded border border-slate-700 overflow-hidden">
      <table className="w-full text-sm font-mono">
        <tbody>
          {parsedDiff.map((line, idx) => (
            <tr
              key={idx}
              className={`
                ${
                  line.type === "add"
                    ? "bg-green-900/10 hover:bg-green-900/20"
                    : line.type === "remove"
                      ? "bg-red-900/10 hover:bg-red-900/20"
                      : line.type === "hunk"
                        ? "bg-blue-900/20"
                        : "bg-slate-900/30 hover:bg-slate-800/30"
                }
                border-b border-slate-700 last:border-b-0
              `}
            >
              {/* Line type indicator */}
              <td
                className={`
                  w-8 px-2 py-1 text-center font-semibold select-none
                  ${
                    line.type === "add"
                      ? "text-green-400"
                      : line.type === "remove"
                        ? "text-red-400"
                        : line.type === "hunk"
                          ? "text-blue-400"
                          : "text-slate-500"
                  }
                `}
              >
                {line.type === "add"
                  ? "+"
                  : line.type === "remove"
                    ? "-"
                    : line.type === "hunk"
                      ? ""
                      : ""}
              </td>

              {/* Line number */}
              <td className="w-12 px-3 py-1 text-slate-500 text-right select-none">
                {idx}
              </td>

              {/* Code content */}
              <td
                className={`
                  flex-1 px-3 py-1 text-slate-300 break-all
                  ${line.type === "hunk" ? "text-blue-400 font-semibold" : ""}
                `}
              >
                {line.type === "hunk" ? (
                  <span className="whitespace-pre-wrap">{line.content}</span>
                ) : (
                  <span className="whitespace-pre-wrap">{line.content}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {parsedDiff.length >= maxLines && (
        <div className="px-4 py-3 bg-slate-800/50 text-slate-400 text-xs border-t border-slate-700">
          Showing {maxLines} lines of diff. Full diff is available on GitHub.
        </div>
      )}
    </div>
  );
}
