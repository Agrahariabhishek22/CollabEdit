import React from "react";
import { X, GitBranch, AlertCircle } from "lucide-react";

export default function PushConfirmModal({ isOpen, onClose, onPush, isLoading, currentBranch }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100">Push to Remote</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 mb-4 p-4 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
          <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200">
            <p className="font-medium mb-1">Are you sure?</p>
            <p className="text-yellow-300/80">This will push your changes to the remote repository.</p>
          </div>
        </div>

        {/* Branch Info */}
        <div className="flex items-center gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg mb-6">
          <GitBranch size={16} className="text-indigo-400" />
          <div>
            <p className="text-xs text-slate-500 font-medium">Branch to push</p>
            <p className="text-sm text-slate-200">{currentBranch}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onPush}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-slate-100 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Pushing..." : "Push"}
          </button>
        </div>
      </div>
    </div>
  );
}
