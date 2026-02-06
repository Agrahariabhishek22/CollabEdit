// components/GitCloneModal.jsx
import React, { useState } from 'react';
import { Github, Loader2, X, GitBranch, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function GitCloneModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isCloning, 
  cloneProgress 
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");

  // Validate GitHub/GitLab URL
  const validateUrl = (url) => {
    const isValid = url.includes("github.com") || url.includes("gitlab.com");
    if (!isValid && url.length > 0) {
      setError("Only GitHub and GitLab URLs are supported");
    } else {
      setError("");
    }
    return isValid;
  };

  const handleConfirm = () => {
    if (!repoUrl.trim()) {
      setError("Repository URL is required");
      return;
    }
    if (!validateUrl(repoUrl)) {
      return;
    }
    onConfirm(repoUrl);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50 bg-slate-900/50">
          <h2 className="text-[11px] font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Github size={16} className="text-indigo-500" /> Clone Git Repository
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            disabled={isCloning}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {isCloning ? (
            // --- CLONING PROGRESS VIEW ---
            <div className="py-10 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {/* Outer Ring */}
                <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full"></div>
                
                {/* Spinning Progress */}
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="48" cy="48" r="44"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * cloneProgress) / 100}
                    className="text-indigo-500 transition-all duration-300"
                  />
                </svg>
                
                {/* Animated Git Icon */}
                <div className="absolute">
                  <GitBranch size={32} className="text-white animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-white font-black uppercase text-[10px] tracking-widest">
                  Cloning Repository
                </h3>
                <p className="text-slate-500 text-[9px] leading-relaxed max-w-[220px] mx-auto uppercase font-bold">
                  Bhai, repo clone ho raha hai... Partial clone se tezi aa rahi hai!
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Loader2 size={14} className="text-indigo-400 animate-spin" />
                  <span className="text-[10px] font-black text-indigo-400 uppercase">
                    {cloneProgress}% Complete
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // --- FORM VIEW ---
            <div className="space-y-6">
              {/* Repository URL Input */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Repository URL <span className='text-red-500'>*</span>
                </label>
                <div className="relative">
                  <input 
                    className={`w-full bg-slate-950 border ${error ? 'border-red-500/50' : 'border-slate-800'} rounded-2xl p-4 pl-11 text-sm text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all`}
                    placeholder="https://github.com/username/repo.git"
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      validateUrl(e.target.value);
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleConfirm()}
                  />
                  <Github size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                </div>
                
                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-[9px] font-bold uppercase ml-1 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={12} />
                    {error}
                  </div>
                )}
              </div>

              {/* Supported Platforms Info */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 space-y-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Supported Platforms
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-lg text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                    <Github size={10} /> GitHub
                  </span>
                  {/* <span className="px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-lg text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                    <GitBranch size={10} /> GitLab
                  </span> */}
                </div>
              </div>

              {/* Example URLs */}
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                  Example URLs
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => setRepoUrl("https://github.com/facebook/react.git")}
                    className="w-full text-left px-3 py-2 bg-slate-950/30 hover:bg-slate-800/30 border border-slate-800/50 rounded-xl text-[9px] font-mono text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    https://github.com/facebook/react.git
                  </button>
                  {/* <button
                    onClick={() => setRepoUrl("https://gitlab.com/gitlab-org/gitlab.git")}
                    className="w-full text-left px-3 py-2 bg-slate-950/30 hover:bg-slate-800/30 border border-slate-800/50 rounded-xl text-[9px] font-mono text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    https://gitlab.com/gitlab-org/gitlab.git
                  </button> */}
                </div>
              </div>

              {/* Clone Button */}
              <button 
                onClick={handleConfirm}
                disabled={!repoUrl.trim() || !!error}
                className="w-full bg-indigo-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Start Clone
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}