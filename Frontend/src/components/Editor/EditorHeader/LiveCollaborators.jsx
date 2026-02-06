import React, { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { useSocket } from "../../../hooks/useSocket";

const USER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
  "#85C1E2", // Light Blue
];

export default function LiveCollaborators({ projectId, fileId }) {
  const [collaborators, setCollaborators] = useState([]);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !projectId || !fileId) return;

    // Listen for collaborator join/leave events
    const handleCollaboratorJoined = (data) => {
      setCollaborators((prev) => {
        const exists = prev.find((c) => c.id === data.userId);
        if (exists) return prev;
        return [...prev, data];
      });
    };

    const handleCollaboratorLeft = (data) => {
      setCollaborators((prev) => prev.filter((c) => c.id !== data.userId));
    };

    const handleCollaboratorsList = (data) => {
      setCollaborators(data.collaborators || []);
    };

    socket.on("collaborator:joined", handleCollaboratorJoined);
    socket.on("collaborator:left", handleCollaboratorLeft);
    socket.on("collaborators:list", handleCollaboratorsList);

    // Request current collaborators list on mount
    socket.emit("collaborators:get", { projectId, fileId });

    return () => {
      socket.off("collaborator:joined", handleCollaboratorJoined);
      socket.off("collaborator:left", handleCollaboratorLeft);
      socket.off("collaborators:list", handleCollaboratorsList);
    };
  }, [socket, projectId, fileId]);

  const getColorForUser = (index) => USER_COLORS[index % USER_COLORS.length];

  if (collaborators.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-md">
      <Users size={16} className="text-slate-400" />
      <div className="flex -space-x-2">
        {collaborators.map((collaborator, index) => (
          <div
            key={collaborator.id}
            className="relative group"
            title={collaborator.email}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-slate-900 cursor-pointer transition-transform hover:scale-110"
              style={{
                backgroundColor: getColorForUser(index),
              }}
            >
              {collaborator.email?.charAt(0).toUpperCase() || "?"}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-700 text-slate-100 text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {collaborator.email}
            </div>
          </div>
        ))}
      </div>
      <span className="text-xs text-slate-400">
        {collaborators.length} {collaborators.length === 1 ? "user" : "users"}
      </span>
    </div>
  );
}
