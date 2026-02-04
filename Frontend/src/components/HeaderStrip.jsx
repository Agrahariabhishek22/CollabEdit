import React, { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  Folder,
  Scan,
  ChevronDown,
  Monitor,
  Github,
  Bell,
  Loader2,
  Files,
} from "lucide-react";
import ScanModal from "../modals/ScanModal";
import axios from "axios";
import { scanFolder } from "../utils/useFileScanner";
import { toast } from "react-toastify";

import NotificationPopover from "./NotificationPopover";

export default function HeaderStrip({
  sidebarOpen,
  onToggleSidebar,
  unreadCount,
}) {
  const [showScanMenu, setShowScanMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  // Bahar click karne par band karne ke liye
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowScanMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- SCAN & UPLOAD LOCAL STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- UPLOAD HANDLER ---
  const handleStartUpload = async (projName, webkitFiles) => {
    setIsModalOpen(false);
    setIsUploading(true);

    const { queue } = await scanFolder(webkitFiles);

    if (queue.length === 0) {
      alert("Bhai, koi valid source code files nahi mili!");
      setIsUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("projectName", projName);
    queue.forEach((item) => {
      // Backend preserve structure logic
      formData.append("files", item.fileRef, item.relativePath);
      formData.append("paths", item.relativePath);
      // console.log(item);
    });

    try {
      await axios.post("http://localhost:3000/api/projects/upload", formData, {
        withCredentials: true,
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      // Success: Yahan hum sidebar refresh trigger kar sakte hain
    } catch (err) {
      console.error("Upload failed", err);
      toast.error(err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-5 z-50">
      {/* Left: Brand & Sidebar Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-indigo-400"
        >
          {sidebarOpen ? <FolderOpen size={20} /> : <Folder size={20} />}
        </button>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-black text-white tracking-tighter uppercase">
            CollabEdit
          </span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase">
            Beta
          </span>
        </div>

        {/* --- DYNAMIC PULSE STICKER --- */}
        {isUploading && (
          <div
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full cursor-pointer hover:bg-indigo-500/20 transition-all animate-in fade-in slide-in-from-left-4"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              <div className="absolute w-3 h-3 bg-indigo-500 rounded-full animate-ping opacity-25" />
            </div>
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
              SYNCING {uploadProgress}%
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-6 relative" ref={dropdownRef}>
        {/* Scan Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowScanMenu(!showScanMenu)} // Hover ki jagah Click
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <Scan size={14} className="text-indigo-500" />
            SCAN PROJECT
            <ChevronDown size={12} />
          </button>

          {showScanMenu && (
            <div
              onMouseEnter={() => setShowScanMenu(true)}
              onMouseLeave={() => setShowScanMenu(false)}
              // top-full ki jagah isme top-8 ya top-9 try karein (adjust according to button height)
              // p-2 padding se gap bhar jayega
              className="absolute top-[90%] right-0 pt-2 w-48 z-50 animate-in fade-in slide-in-from-top-1"
            >
              {/* Inner Wrapper - Asli menu styling yahan rakhein */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1">
                <button
                  onClick={() => {
                    setIsModalOpen(true);
                    setShowScanMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg transition-colors"
                >
                  <Monitor size={16} /> LOCAL SCAN
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg transition-colors">
                  <Github size={16} /> GIT REPO CLONE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif((s) => !s)}
            className="relative p-2 text-slate-400 hover:text-white transition-colors"
          >
            <Bell size={20} />
            {/* {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-500 text-[9px] font-black text-white flex items-center justify-center rounded-full border-2 border-slate-900 animate-pulse">
                {unreadCount}
              </span>
            )} */}
          </button>

          {showNotif && (
            <div className="absolute right-0 mt-2 z-60">
              <NotificationPopover onClose={() => setShowNotif(false)} anchorRef={notifRef} />
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" />
      </div>

      {/* MODAL INTEGRATION */}
      <ScanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleStartUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />
    </header>
  );
}
