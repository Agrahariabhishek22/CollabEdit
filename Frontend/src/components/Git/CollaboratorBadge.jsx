import React from "react";
import { Users } from "lucide-react";

export default function CollaboratorBadge({ collaborators = [] }) {
  if (!collaborators || collaborators.length === 0) return null;

  const maxDisplay = 3;
  const displayUsers = collaborators.slice(0, maxDisplay);
  const hiddenCount = collaborators.length - maxDisplay;

  return (
    <div className="flex items-center gap-1">
      {displayUsers.map((user, idx) => (
        <div
          key={user.id}
          className="relative w-6 h-6 rounded-full bg-indigo-500 border-2 border-slate-800 flex items-center justify-center overflow-hidden group"
          style={{
            marginLeft: idx > 0 ? "-8px" : "0",
            backgroundColor: user.color || "#6366f1",
          }}
          title={user.name}
        >
          {/* Avatar Initials or Icon */}
          <span className="text-xs font-bold text-white">
            {user.name?.[0]?.toUpperCase() || "U"}
          </span>

          {/* Tooltip */}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {user.name}
          </div>
        </div>
      ))}

      {hiddenCount > 0 && (
        <div
          className="relative w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 group"
          title={`+${hiddenCount} more`}
        >
          +{hiddenCount}

          {/* Tooltip for hidden count */}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            +{hiddenCount} more
          </div>
        </div>
      )}
    </div>
  );
}
