import React, { useState, useEffect, useCallback, useMemo } from "react"; // added useMemo
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
  Search, // Added Search icon
  X, // Added X icon for clearing search
} from "lucide-react";
import FileTree from "./FileTree";
import axios from "axios";
import { useRef } from "react";

export default function Sidebar({
  selectedFile,
  onSelectFile,
  onContextMenu,
  onInviteClick,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState("LOCAL");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // Search State
  const navigate = useNavigate();

  // --- RESIZABLE SIDEBAR LOGIC (UNCHANGED) ---
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);

  const startResizing = useCallback((e) => {
    isResizing.current = true;
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
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
      if (newWidth > 160 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, []);

  // --- API INTEGRATION ---
  const fetchInitialRoot = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:3000/api/explorer/tree", {
        withCredentials: true,
      });
      setFiles(res.data.data);
    } catch (err) {
      console.error("Failed to fetch root", err);
      if (err.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialRoot();
  }, [onRefresh]); // Refresh trigger hone par fetch karein

  // --- FILTERING LOGIC (The Core Change) ---
  const displayedFiles = useMemo(() => {
    // 1. Pehle Tab ke base par files alag karo
    let tabFiltered = files.filter((file) => {
      if (activeTab === "GIT") return file.sourceType === "GIT";
      return file.sourceType === "LOCAL" || file.sourceType === "UI_CREATED";
    });

    if (searchQuery.trim() === "") return tabFiltered;

    // 2. Recursive Search Function
    const getFilteredTree = (items, query) => {
      return items.reduce((acc, item) => {
        const isMatch = item.name.toLowerCase().includes(query.toLowerCase());

        // Agar ye folder hai, toh iske bachon (children) mein dhoondo
        if (item.isFolder && item.children) {
          const matchingChildren = getFilteredTree(item.children, query);

          // Agar folder ke andar kuch match mila, toh folder ko rakho aur bache dikhao
          if (matchingChildren.length > 0) {
            acc.push({
              ...item,
              children: matchingChildren,
              isExpanded: true, // Search ke waqt folder apne aap khul jana chahiye
            });
            return acc;
          }
        }

        // Agar file/folder ka naam khud match kar gaya, toh use add karo
        if (isMatch) {
          acc.push(item);
        }

        return acc;
      }, []);
    };

    return getFilteredTree(tabFiltered, searchQuery);
  }, [files, activeTab, searchQuery]);

  const handleFolderExpand = async (folder) => {
    const folderId = folder.id;

    // --- YAHAN CHANGE HAI ---
    // Folder select karne par bhi state update ho jaye
    onSelectFile(folder);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/explorer/subtree/folder/${folderId}`,
        { withCredentials: true },
      );
      const children = res.data.data;

      setFiles((prev) => {
        const injectChildren = (items) => {
          return items.map((item) => {
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
      // Logic same as before, using projectId from filtered list context
      const currentProjectId =
        displayedFiles.length > 0 ? displayedFiles[0].projectId : null;

      if (!currentProjectId) {
        toast.error("Bhai, pehle koi project select karo!");
        return;
      }

      await axios.post(
        `http://localhost:3000/api/files/create`,
        {
          parentFileMetaId: null,
          projectId: currentProjectId,
          name: name,
          isFolder: isFolder,
          content: "",
        },
        { withCredentials: true },
      );

      toast.success(`${isFolder ? "Folder" : "File"} "${name}" ban gaya!`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Creation failed!");
    }
  };

  return (
    <div
      className="relative flex flex-col h-full bg-slate-950 border-r border-slate-800/50"
      style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
    >
      {/* Tab Selector */}
      <div className="flex p-2 gap-1 bg-slate-900/50">
        <button
          onClick={() => {
            setActiveTab("LOCAL");
            setSearchQuery("");
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "LOCAL"
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Monitor size={14} /> Local
        </button>
        <button
          onClick={() => {
            setActiveTab("GIT");
            setSearchQuery("");
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === "GIT"
              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Github size={14} /> Git
        </button>
      </div>

      {/* Toolbar + Search Bar */}
      <div className="flex flex-col border-b border-slate-800/50 bg-slate-900/20">
        {/* Actions Row */}
        <div className="flex items-center justify-around p-2">
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
            title="Refresh"
          >
            <RotateCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Search Input Row */}
        <div className="px-2 pb-2">
          <div className="relative group">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors"
              size={12}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab.toLowerCase()} files...`}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-md py-1.5 pl-7 pr-7 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-slate-700"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
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
            items={displayedFiles} // Filtered and Tab-sorted data sent here
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onFolderExpand={handleFolderExpand}
            onContextMenu={onContextMenu}
            onInviteClick={onInviteClick}
          />
        )}

        {/* Empty State for Search or Empty Tab */}
        {!loading && displayedFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
              {searchQuery
                ? "No matches found"
                : `No ${activeTab.toLowerCase()} items`}
            </p>
          </div>
        )}
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors active:bg-indigo-600 z-50"
      />
    </div>
  );
}
