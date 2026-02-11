import React, { useState } from "react";
import { X, Plus, AlertCircle } from "lucide-react";

export default function CreateBranchModal({
  isOpen,
  onClose,
  onCreateBranch,
  isLoading,
  currentBranch,
}) {
  const [branchName, setBranchName] = useState("");
  const [error, setError] = useState("");
  const branchNameRegex =
    /^(?!\/|.*\/$|.*\.lock$|.*\/.*\.lock$)(?!.*?\.\.)[\x21-\x7E]+(?<!\.|\/|\~|\^|\:|\?|\*|\[)$/;

  // Function to validate
  const isValidBranchName = (name) => {
    // 1. Length check (usually max 255 chars)
    if (!name || name.length > 255) return false;

    // 2. Regex check
    return branchNameRegex.test(name);
  };
  const handleCreateBranch = async () => {
    if (!branchName.trim()) {
      setError("Branch name cannot be empty");
      return;
    }

    // Validate branch name (no spaces, special chars except -)
    if (!isValidBranchName(branchName)) {
      setError(
        "Branch name can only contain letters, numbers, hyphens, underscores, and dots",
      );
      return;
    }

    if (branchName === currentBranch) {
      setError("Branch already exists");
      return;
    }

    try {
      await onCreateBranch(branchName.trim());
      setBranchName("");
      setError("");
      onClose();
    } catch (err) {
      setError(err || "Failed to create branch");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100">
            Create New Branch
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info */}
        <p className="text-sm text-slate-400 mb-4">
          Base branch:{" "}
          <span className="text-indigo-400 font-medium">{currentBranch}</span>
        </p>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {/* Branch Name Input */}
        <input
          type="text"
          value={branchName}
          onChange={(e) => {
            setBranchName(e.target.value);
            setError("");
          }}
          placeholder="e.g., feature/new-auth"
          disabled={isLoading}
          className="w-full mb-4 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />

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
            onClick={handleCreateBranch}
            disabled={isLoading || !branchName.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {isLoading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
