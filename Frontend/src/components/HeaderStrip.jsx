// components/HeaderStrip.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  Folder,
  Scan,
  ChevronDown,
  Monitor,
  Github,
  Bell,
  LogOut, // Logout icon add kiya
  GitBranch,
} from "lucide-react";
import ScanModal from "../modals/LocalScanModal";
import GitCloneModal from "../modals/GitCloneModal";
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowScanMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- LOCAL SCAN STATES ---
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- GIT CLONE STATES ---
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);

  // --- LOGOUT HANDLER ---
  const handleLogout = async () => {
    const confirmLogout = window.confirm("Do you really want to logout?");
    if (!confirmLogout) return;

    try {
      // Backend API call to invalidate session/cookie
      await axios.post("http://localhost:3000/api/auth/logout", {}, { withCredentials: true });
      
      // LocalStorage saaf karna zaroori hai taaki frontend ko pta chale user chala gaya
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      toast.success("Logged out successfully!");
      
      // Page reload ya redirect taaki login screen dikhe
      window.location.href = "/login"; 
    } catch (err) {
      console.error("Logout failed", err);
      toast.error("Logout failed, please try again!");
    }
  };

  // --- LOCAL SCAN HANDLER ---
  const handleStartUpload = async (projName, webkitFiles) => {
    setIsLocalModalOpen(false);
    setIsUploading(true);

    const { queue } = await scanFolder(webkitFiles);

    if (queue.length === 0) {
      toast.error("Bhai, koi valid source code files nahi mili!");
      setIsUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("projectName", projName);
    queue.forEach((item) => {
      formData.append("files", item.fileRef, item.relativePath);
      formData.append("paths", item.relativePath);
    });

    try {
      await axios.post("http://localhost:3000/api/projects/upload", formData, {
        withCredentials: true,
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      toast.success("Project uploaded successfully!");
    } catch (err) {
      console.error("Upload failed", err);
      toast.error(err?.response?.data?.message || "Upload failed!");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // --- GIT CLONE HANDLER ---
  const handleStartClone = async (repoUrl) => {
    setIsGitModalOpen(false);
    setIsCloning(true);
    setCloneProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setCloneProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await axios.post(
        "http://localhost:3000/api/git/clone",
        { repoUrl },
        { withCredentials: true }
      );

      clearInterval(progressInterval);
      setCloneProgress(100);

      setTimeout(() => {
        toast.success(`Repository cloned: ${response.data.name}`);
        setIsCloning(false);
        setCloneProgress(0);
      }, 500);

    } catch (err) {
      console.error("Clone failed", err);
      toast.error(err?.response?.data?.message || "Git clone failed!");
      setIsCloning(false);
      setCloneProgress(0);
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

        {isUploading && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full cursor-pointer hover:bg-indigo-500/20 transition-all animate-in fade-in slide-in-from-left-4">
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              <div className="absolute w-3 h-3 bg-indigo-500 rounded-full animate-ping opacity-25" />
            </div>
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
              UPLOADING {uploadProgress}%
            </span>
          </div>
        )}

        {isCloning && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full cursor-pointer hover:bg-emerald-500/20 transition-all animate-in fade-in slide-in-from-left-4">
            <GitBranch size={14} className="text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
              CLONING {cloneProgress}%
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions & Logout */}
      <div className="flex items-center gap-6 relative" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => setShowScanMenu(!showScanMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white hover:border-slate-700 transition-all"
          >
            <Scan size={14} className="text-indigo-500" />
            SCAN PROJECT
            <ChevronDown size={12} />
          </button>

          {showScanMenu && (
            <div className="absolute top-[90%] right-0 pt-2 w-48 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1">
                <button
                  onClick={() => {
                    setIsLocalModalOpen(true);
                    setShowScanMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400 rounded-lg transition-colors"
                >
                  <Monitor size={16} /> LOCAL SCAN
                </button>
                <button
                  onClick={() => {
                    setIsGitModalOpen(true);
                    setShowScanMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg transition-colors"
                >
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
          </button>

          {showNotif && (
            <div className="absolute right-0 mt-2 z-60">
              <NotificationPopover
                onClose={() => setShowNotif(false)}
                anchorRef={notifRef}
              />
            </div>
          )}
        </div>

        {/* --- LOGOUT BUTTON (Profile Avatar ki jagah) --- */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-black text-red-400 hover:bg-red-500 hover:text-white transition-all group"
        >
          <LogOut size={14} className="group-hover:scale-110 transition-transform" />
          LOGOUT
        </button>
      </div>

      {/* --- MODALS --- */}
      <ScanModal
        isOpen={isLocalModalOpen}
        onClose={() => setIsLocalModalOpen(false)}
        onConfirm={handleStartUpload}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      <GitCloneModal
        isOpen={isGitModalOpen}
        onClose={() => setIsGitModalOpen(false)}
        onConfirm={handleStartClone}
        isCloning={isCloning}
        cloneProgress={cloneProgress}
      />
    </header>
  );
}