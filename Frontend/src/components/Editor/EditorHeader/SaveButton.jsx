import React, { useState } from "react";
import { Save, Check, AlertCircle } from "lucide-react";
import { useSocket } from "../../../hooks/useSocket";

export default function SaveButton({ selectedFile, editorContent }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "success" | "error" | null
  const { socket } = useSocket();

  const handleSave = async () => {
    if (!selectedFile?.id) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/files/${selectedFile.id}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          content: editorContent,
          projectId: selectedFile.projectId,
        }),
      });

      if (response.ok) {
        setSaveStatus("success");
        
        // Emit socket event to notify other collaborators
        socket?.emit("file:saved", {
          fileId: selectedFile.id,
          projectId: selectedFile.projectId,
          timestamp: new Date().toISOString(),
        });

        // Auto-hide success message after 2 seconds
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (error) {
      console.error("Save failed:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        disabled={isSaving || !selectedFile?.id}
        className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
          isSaving
            ? "bg-slate-700 text-slate-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        <Save size={16} />
        <span>{isSaving ? "Saving..." : "Save"}</span>
      </button>

      {saveStatus === "success" && (
        <div className="flex items-center gap-1 text-green-400 text-sm">
          <Check size={14} />
          <span>Saved</span>
        </div>
      )}

      {saveStatus === "error" && (
        <div className="flex items-center gap-1 text-red-400 text-sm">
          <AlertCircle size={14} />
          <span>Save failed</span>
        </div>
      )}
    </div>
  );
}
