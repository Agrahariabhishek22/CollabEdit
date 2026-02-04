// components/ScanModal.jsx
import React, { useState } from 'react';
import { FolderSearch, Loader2, ShieldAlert, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function ScanModal({ isOpen, onClose, onConfirm, isUploading, uploadProgress }) {
  const [projName, setProjName] = useState("");
  const [files, setFiles] = useState(null);

  if (!isOpen) return null;

  const modalContent=(
    // Isko 'items-center' ki jagah 'items-start' + 'pt-20' bhi kar sakte ho agar upar chahiye
    // Par perfect center ke liye 'items-center' hi best hai
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      
      {/* Container wrapper to handle overflow on small screens */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/50 bg-slate-900/50">
           <h2 className="text-[11px] font-black text-white uppercase tracking-tighter flex items-center gap-2">
             <FolderSearch size={16} className="text-indigo-500" /> New Project Scan
           </h2>
           <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
             <X size={18} />
           </button>
        </div>

        <div className="p-6">
          {isUploading ? (
            // --- PROGRESS VIEW ---
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
                    strokeDashoffset={276 - (276 * uploadProgress) / 100}
                    className="text-indigo-500 transition-all duration-300"
                  />
                </svg>
                <span className="absolute text-sm font-black text-white">{uploadProgress}%</span>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-white font-black uppercase text-[10px] tracking-widest">Uploading Structure</h3>
                <p className="text-slate-500 text-[9px] leading-relaxed max-w-[200px] mx-auto uppercase font-bold">
                  Bhai, validation ho gaya hai, files server par line mein hain...
                </p>
              </div>
            </div>
          ) : (
            // --- FORM VIEW ---
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Project Name <span className='text-red-500'>*</span></label>
                <input 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                  placeholder="e.g. neural-engine-v1"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                />
              </div>

              <div className="group relative border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all cursor-pointer">
                <input 
                  type="file" webkitdirectory="true" 
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={(e) => setFiles(e.target.files)}
                />
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                    <Loader2 size={24} className={`text-slate-500 group-hover:text-indigo-400 ${files ? 'animate-bounce' : ''}`} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                    {files ? `${files.length} Files Locked & Ready` : "Drop Folder or Click to Browse"}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => onConfirm(projName, files)}
                className="w-full bg-indigo-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                Start Scan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return createPortal(
    modalContent,
    document.body
  );
}