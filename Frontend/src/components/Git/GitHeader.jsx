import React, { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  GitBranch,
  GitCommit,
  Plus,
  Upload,
  History,
  ShieldCheck,
  User,
} from "lucide-react";

export default function GitHeader({
  projectName,
  currentBranch,
  branches,
  onBranchSwitch,
  onBack,
  isLoading,
  onCommitClick,
  onCreateBranchClick,
  onPushClick,
  onHistoryClick,
  userRole = "VIEWER",
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const canEdit = userRole === "ADMIN" || userRole === "EDITOR";
  const canAdmin = userRole === "ADMIN";

  return (
    <div className="flex items-center justify-between h-20 px-6 border-b border-slate-800/50 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
      {/* Left: Project Branding */}
      <div className="flex items-center gap-5">
        <button
          onClick={onBack}
          className="group p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 transition-all border border-transparent hover:border-slate-700"
          title="Back to Dashboard"
        >
          <ArrowLeft
            size={20}
            className="group-hover:-translate-x-1 transition-transform"
          />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {projectName}
            </h1>
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                canAdmin
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {canAdmin ? <ShieldCheck size={10} /> : <User size={10} />}
              {userRole}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Workspace • {currentBranch}
          </p>
        </div>
      </div>

      {/* Right: Actions & Branch Switcher */}
      <div className="flex items-center gap-4">
        {/* Action Group */}
        <div className="flex items-center p-1 bg-slate-950/50 border border-slate-800 rounded-xl">
          {/* History */}
          <HeaderActionButton
            onClick={onHistoryClick}
            icon={<History size={16} />}
            label="History"
            isLoading={isLoading}
          />

          {/* Commit */}
          {canEdit && (
            <HeaderActionButton
              onClick={onCommitClick}
              icon={<GitCommit size={16} />}
              label="Commit"
              isLoading={isLoading}
              colorClass="hover:text-amber-400"
            />
          )}

          {/* Admin Tools */}
          {canAdmin && (
            <>
              <div className="w-px h-6 bg-slate-800 mx-1" />
              <HeaderActionButton
                onClick={onCreateBranchClick}
                icon={<Plus size={16} />}
                label="New Branch"
                isLoading={isLoading}
              />
              <HeaderActionButton
                onClick={onPushClick}
                icon={<Upload size={16} />}
                label="Push"
                isLoading={isLoading}
                colorClass="text-indigo-400 hover:text-indigo-300"
              />
            </>
          )}
        </div>

        {/* Branch Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isLoading}
            className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10 transition-all disabled:opacity-50 disabled:grayscale"
          >
            <GitBranch size={16} className="text-indigo-200" />
            <span className="text-sm font-bold tracking-wide">
              {currentBranch}
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-300 ${dropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Dropdown Menu - Content matches your original logic */}
          {dropdownOpen && !isLoading && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 py-2 max-h-80 overflow-y-auto custom-scrollbar ring-1 ring-white/5">
              <div className="px-3 py-1 mb-1 border-b border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Switch Branch
                </p>
              </div>

              {branches.length === 0 ? (
                <div className="px-4 py-6 text-slate-500 text-xs text-center flex flex-col items-center gap-2">
                  <GitBranch size={20} className="opacity-20" />
                  <p className="font-bold uppercase tracking-tighter">
                    No branches found
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 px-1">
                  {branches.map((branch) => {
                    const isActive = branch.name === currentBranch;

                    return (
                      <button
                        key={branch.name} // ✅ Fix: object ki jagah name use karo
                        onClick={() => {
                          if (!isActive) onBranchSwitch(branch.name);
                          setDropdownOpen(false);
                        }}
                        className={`group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-indigo-600/10 text-indigo-400 cursor-default"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <GitBranch
                            size={14}
                            className={
                              isActive
                                ? "text-indigo-500"
                                : "text-slate-600 group-hover:text-slate-400"
                            }
                          />
                          <span className="truncate">{branch.name}</span>
                        </div>

                        {isActive && (
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        )}

                        {/* {branch.isRemote && !isActive && (
                          <span className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded uppercase tracking-tighter">
                            Remote
                          </span>
                        )} */}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Internal Helper Component for Buttons
function HeaderActionButton({
  onClick,
  icon,
  label,
  isLoading,
  colorClass = "text-slate-400 hover:text-slate-100",
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-30 group ${colorClass}`}
    >
      {icon}
      <span className="text-xs font-bold uppercase tracking-wide hidden lg:inline-block">
        {label}
      </span>
    </button>
  );
}
