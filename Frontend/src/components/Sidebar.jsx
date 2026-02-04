import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  FolderPlus,
  FilePlus,
  RotateCw,
  Loader2,
  Github,
  Monitor,
} from "lucide-react";
import FileTree from "./FileTree";
import axios from "axios";
import { useRef } from "react";
// import { io } from 'socket.io-client';

// const socket = io(process.env.REACT_APP_BACKEND_URL);

export default function Sidebar({
  selectedFile,
  onSelectFile,
  onContextMenu,
  onInviteClick,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState("LOCAL");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- RESIZABLE SIDEBAR LOGIC ---
  const [sidebarWidth, setSidebarWidth] = useState(260); // Default width
  const isResizing = useRef(false);

  const startResizing = useCallback((e) => {
    isResizing.current = true;
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize"; // Cursor change karein
    document.body.style.userSelect = "none"; // Text selection off karein
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  const resize = useCallback((e) => {
    if (isResizing.current) {
      const newWidth = e.clientX;
      // Constraints: Sidebar ko 160px se 600px ke beech rakhein
      if (newWidth > 160 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, []);

  // --- 1. LIVE SYNC LOGIC (Socket.io) ---
  //   useEffect(() => {
  //     // Listen for structure changes from other users or git ops
  //     socket.on('file_tree_update', (payload) => {
  //       const { action, meta, parentId } = payload;

  //       setFiles((prev) => {
  //         const updateTree = (items) => {
  //           return items.map((item) => {
  //             // Addition: Agar parent mil gaya toh usme naya meta push karo
  //             if (action === 'ADD' && item.id === parentId) {
  //               return { ...item, children: [...(item.children || []), meta] };
  //             }
  //             // Rename
  //             if (action === 'RENAME' && item.id === meta.id) {
  //               return { ...item, name: meta.name };
  //             }
  //             // Recursively search in children
  //             if (item.children) {
  //               return { ...item, children: updateTree(item.children) };
  //             }
  //             return item;
  //           }).filter(item => action === 'DELETE' ? item.id !== meta.id : true);
  //         };

  //         // Root level addition check
  //         if (action === 'ADD' && !parentId) return [...prev, meta];
  //         return updateTree(prev);
  //       });
  //     });

  //     return () => socket.off('file_tree_update');
  //   }, []);

  // --- 2. API INTEGRATION (Initial Load & Lazy Load) ---
  const fetchInitialRoot = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:3000/api/explorer/tree", {
        withCredentials: true,
      });
      setFiles(res.data.data);
      // console.log(res);
    } catch (err) {
      console.error("Failed to fetch root", err);
      if (err.response && err.response.status === 401) {
        // Handle unauthorized access, maybe redirect to login
        toast.error("Session expired. Please login again.");
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialRoot();
  }, [activeTab]);

  const handleFolderExpand = async (folderId) => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/explorer/subtree/folder/${folderId}`,
        {
          withCredentials: true,
        },
      );
      const children = res.data.data;
      // console.log(children);

      setFiles((prev) => {
        const injectChildren = (items) => {
          return items.map((item) => {
            // console.log(item);

            if (item.id === folderId) {
              return { ...item, children, isExpanded: !item.isExpanded };
            }
            if (item.children) {
              return { ...item, children: injectChildren(item.children) };
            }
            return item;
          });
        };
        return injectChildren(prev);
      });
      // console.log(files);
    } catch (err) {
      console.error("Lazy load failed", err);
    }
  };

const handleToolbarAction = async (action) => {
    if (action === "REFRESH") {
      onRefresh(); 
      return;
    }

    const isFolder = action === "NEW_FOLDER";
    const name = prompt(`Enter ${isFolder ? "Folder" : "File"} name:`);

    if (!name) return;

    try {
      // ✅ LOGIC: Agar Toolbar se create kar rahe hain, toh 
      // parentFileMetaId hamesha NULL jayega kyunki ye ROOT level par ban raha hai.
      
      // Safety check: Ensure we have a projectId from the existing files
      const currentProjectId = files.length > 0 ? files[0].projectId : null;

      if (!currentProjectId) {
        toast.error("Bhai, pehle koi project select karo ya backend se data aane do!");
        return;
      }

      await axios.post(
        `http://localhost:3000/api/files/create`, // Tera standard creation endpoint
        {
          parentFileMetaId: null, // Toolbar se hamesha root par banta hai
          projectId: currentProjectId,
          name: name,
          isFolder: isFolder,
          content: "" // Default empty content
        },
        { withCredentials: true }
      );

      toast.success(`${isFolder ? 'Folder' : 'File'} "${name}" Project Root mein ban gaya!`);
      onRefresh(); // Refresh sidebar to show the new root-level entry
      
    } catch (err) {
      console.error("Creation Error:", err);
      toast.error(err.response?.data?.message || "Creation failed bhai!");
    }
  };

  return (
    <div
      className="relative flex flex-col h-full bg-slate-950 border-r border-slate-800/50"
      style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
    >
      {" "}
      {/* Tab Selector - Elite Style */}
      <div className="flex p-2 gap-1 bg-slate-900/50">
        <button
          onClick={() => setActiveTab("LOCAL")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "LOCAL"
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Monitor size={14} /> Local
        </button>
        <button
          onClick={() => setActiveTab("GIT")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "GIT"
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Github size={14} /> Git
        </button>
      </div>
      {/* Toolbar - Actions logic with accessMode check */}
      <div className="flex items-center justify-around p-2 border-b border-slate-800/50 bg-slate-900/20">
        <button
          onClick={() => handleToolbarAction("NEW_FILE")}
          className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors"
          title="New File"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => handleToolbarAction("NEW_FOLDER")}
          className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors"
          title="New Folder"
        >
          <FolderPlus size={14} />
        </button>
        <button
          onClick={() => handleToolbarAction("REFRESH")}
          className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors"
          title="Refresh Explorer"
        >
          <RotateCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {/* Dynamic File Tree Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Loader2 className="animate-spin text-indigo-500" size={20} />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
              Syncing Tree...
            </span>
          </div>
        ) : (
          <FileTree
            items={files}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onFolderExpand={handleFolderExpand}
            onContextMenu={onContextMenu}
            onInviteClick={onInviteClick}
          />
        )}
      </div>
      {/* --- RESIZER HANDLE --- */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors active:bg-indigo-600 z-50"
      />
    </div>
  );
}
