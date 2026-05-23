/**
 * components/Editor/ConflictBadges.jsx
 * 
 * Small badges that appear in gutter to indicate conflicts
 * Clickable to open ConflictModal
 * 
 * Used by GutterPanel to show conflict indicators alongside line numbers
 */

import React from "react";
import { getConflictConfig } from "../../utils/conflictTypes";

const ConflictBadges = ({ conflicts, lineIndex, onConflictClick }) => {
  if (!conflicts || conflicts.length === 0) return null;

  /**
   * For 1 conflict: show single badge
   * For 2+ conflicts: show stacked badges up to 3, then "..." if more
   */
  const displayConflicts = conflicts.slice(0, 2);
  const hasMore = conflicts.length > 2;

  return (
    <div className="absolute right-0 top-0 -mr-1 flex flex-col gap-px">
      {displayConflicts.map((conflict) => {
        const config = getConflictConfig(conflict.type);

        return (
          <button
            key={conflict.id}
            onClick={() => onConflictClick(conflict)}
            title={`${config.label}: ${conflict.symbol}`}
            className={`
              w-2 h-2 rounded-full cursor-pointer
              ${config.color === "red" ? "bg-red-500 hover:bg-red-400" : ""}
              ${config.color === "orange" ? "bg-orange-500 hover:bg-orange-400" : ""}
              ${config.color === "yellow" ? "bg-yellow-500 hover:bg-yellow-400" : ""}
              ${config.color === "purple" ? "bg-purple-500 hover:bg-purple-400" : ""}
              ${config.color === "blue" ? "bg-blue-500 hover:bg-blue-400" : ""}
              transition-all duration-200 transform hover:scale-150 hover:shadow-lg
              ring-1 ring-gray-800 hover:ring-gray-600
            `}
          />
        );
      })}
      {hasMore && (
        <span className="text-xs text-gray-500 text-center px-1">
          +{conflicts.length - 2}
        </span>
      )}
    </div>
  );
};

export default ConflictBadges;
