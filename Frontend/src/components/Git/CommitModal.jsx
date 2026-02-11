import React, { useState } from "react";
import { X, GitCommit, User, Mail, Info } from "lucide-react";

export default function CommitModal({
  isOpen,
  onClose,
  onCommit,
  isLoading,
  filesChanged = 0,
}) {
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");
  // New Optional Fields for Git Identity
  const [gitName, setGitName] = useState("");
  const [gitEmail, setGitEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Bhai, commit message zaruri hai!");
      return;
    }

    try {
      // Logic: Agar user ne fields khali chhodi hain, toh backend default profile use karega
      await onCommit({
        message,
        description,
        name: gitName.trim() || null,
        email: gitEmail.trim() || null,
      });

      // Reset on success
      setMessage("");
      setDescription("");
      setGitName("");
      setGitEmail("");
      onClose();
    } catch (err) {
      setError(err.message || "Commit failed, check logs");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header Section */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <GitCommit className="text-indigo-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                Finalize Changes
              </h2>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                Git Commit Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar"
        >
          {/* Change Stats */}
          {filesChanged > 0 && (
            <div className="flex items-center gap-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
              <Info size={16} className="text-indigo-400" />
              <p className="text-sm font-medium text-slate-300">
                Found{" "}
                <span className="text-indigo-400 font-bold">
                  {filesChanged}
                </span>{" "}
                modified resource{filesChanged !== 1 ? "s" : ""} to stage.
              </p>
            </div>
          )}

          {/* Core Commit Info */}
          <div className="space-y-4">
            <div className="group">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Message <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: feat: setup real-time yjs sync"
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                maxLength="100"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                Long Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the technical context of this commit..."
                rows="3"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm resize-none"
              />
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* Optional Identity Overrides */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
              Optional Author Info
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <User
                  size={14}
                  className="absolute left-3 top-3 text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Git User Name"
                  value={gitName}
                  onChange={(e) => setGitName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:border-slate-600 focus:outline-none transition-colors"
                />
              </div>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-3 text-slate-500"
                />
                <input
                  type="email"
                  placeholder="Git Email"
                  value={gitEmail}
                  onChange={(e) => setGitEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:border-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Leave blank to use your default CollabEdit profile identity.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-medium animate-shake">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-all"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[1.5] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !message.trim()}
            >
              {isLoading ? "Finalizing Snapshot..." : "Commit Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
``;
