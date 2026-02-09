import React, { useState } from "react";
import { ArrowLeft, ChevronDown, GitBranch } from "lucide-react";

export default function GitHeader({
  projectName,
  currentBranch,
  branches,
  onBranchSwitch,
  onBack,
  isLoading,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800/50 bg-slate-900/40 backdrop-blur-sm">
      {/* Left: Back Button + Project Name */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-indigo-400" />
          <h1 className="text-lg font-bold text-slate-100">{projectName}</h1>
        </div>
      </div>

      {/* Right: Branch Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 hover:text-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-sm font-medium">{currentBranch}</span>
          <ChevronDown size={16} />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && !isLoading && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
            {branches.length === 0 ? (
              <div className="px-4 py-3 text-slate-500 text-sm text-center">
                No branches found
              </div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => {
                    onBranchSwitch(branch);
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors border-l-4 ${
                    currentBranch === branch
                      ? "bg-indigo-500/20 border-indigo-500 text-indigo-400 font-medium"
                      : "hover:bg-slate-800/50 border-transparent text-slate-300 hover:text-slate-100"
                  }`}
                >
                  {branch}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
