import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Trash2, Copy } from "lucide-react";
import { useSocket } from "../../../hooks/useSocket";

export default function CheckpointDropdown({ selectedFile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const { socket } = useSocket();

  // Fetch checkpoints for the selected file
  useEffect(() => {
    if (selectedFile?.id) {
      fetchCheckpoints();
    }
  }, [selectedFile?.id]);

  const fetchCheckpoints = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      const response = await fetch(
        `/api/files/${selectedFile.id}/checkpoints`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setCheckpoints(data.checkpoints || []);
      }
    } catch (error) {
      console.error("Failed to fetch checkpoints:", error);
    } finally {
      setLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCheckpointClick = (checkpoint) => {
    // Emit socket event to preview checkpoint
    socket?.emit("checkpoint:preview", {
      fileId: selectedFile.id,
      checkpointId: checkpoint.id,
      userId: checkpoint.userId,
    });
    setIsOpen(false);
  };

  const handleDeleteCheckpoint = async (e, checkpointId) => {
    e.stopPropagation();
    try {
      // TODO: Replace with actual API call
      const response = await fetch(
        `/api/files/${selectedFile.id}/checkpoints/${checkpointId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (response.ok) {
        setCheckpoints(
          checkpoints.filter((cp) => cp.id !== checkpointId)
        );
      }
    } catch (error) {
      console.error("Failed to delete checkpoint:", error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
      >
        <span>Checkpoint</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-10 left-0 w-64 bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50">
          {loading ? (
            <div className="px-4 py-3 text-slate-400 text-sm">
              Loading checkpoints...
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="px-4 py-3 text-slate-400 text-sm">
              No checkpoints saved
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint.id}
                  onClick={() => handleCheckpointClick(checkpoint)}
                  className="px-4 py-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">
                      {checkpoint.userEmail || "Unknown"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(checkpoint.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteCheckpoint(e, checkpoint.id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
