import React, { useState, useEffect } from "react";
import { X, Copy, RotateCcw } from "lucide-react";
import { useSocket } from "../hooks/useSocket";

export default function CheckpointPreviewModal({
  checkpoint,
  selectedFile,
  onClose,
  onRevert,
}) {
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (checkpoint?.content) {
      setContent(checkpoint.content);
    }
  }, [checkpoint]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleRevert = async () => {
    setIsReverting(true);

    try {
      // Emit revert request with voting mechanism
      socket?.emit("checkpoint:revert-request", {
        fileId: selectedFile.id,
        checkpointId: checkpoint.id,
        projectId: selectedFile.projectId,
      });

      // TODO: Show voting modal here
      onRevert?.();
      onClose();
    } catch (error) {
      console.error("Failed to request revert:", error);
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-4xl max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Checkpoint Preview
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {checkpoint?.userEmail} · {new Date(checkpoint?.timestamp).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content (Read-only Editor) */}
        <div className="flex-1 overflow-auto bg-slate-950">
          <pre className="p-4 text-slate-200 font-mono text-sm whitespace-pre-wrap break-words">
            {content}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              }`}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleRevert}
              disabled={isReverting}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                isReverting
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}
            >
              <RotateCcw size={14} />
              {isReverting ? "Requesting..." : "Revert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
