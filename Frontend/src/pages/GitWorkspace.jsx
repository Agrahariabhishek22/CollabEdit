import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../hooks/useSocket";
import GitHeader from "../components/Git/GitHeader";
import GitExplorer from "../components/Git/GitExplorer";
import LoadingOverlay from "../components/Git/LoadingOverlay";
import axios from "axios";
import { toast } from "react-toastify";

export default function GitWorkspace({ project, onBackToDashboard, onOpenEditor }) {
  const { socket } = useSocket();
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(project?.currentBranch || "main");
  const [filesInView, setFilesInView] = useState([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [pathStack, setPathStack] = useState([]); // Track folder hierarchy
  const [isLoading, setIsLoading] = useState(false);
  const [isBranchSwitching, setIsBranchSwitching] = useState(false);
  const initialLoadRef = useRef(false);

  // 1. Fetch branches on mount
  useEffect(() => {
    if (!project?.id || initialLoadRef.current) return;
    initialLoadRef.current = true;

    const fetchBranches = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/git/${project.id}/branches`,
          { withCredentials: true }
        );
        const branchList = res.data.data || [];
        setBranches(branchList);
        
        // Set current branch from response or project
        const currentBr = res.data.recentBranch || project.currentBranch || "main";
        setCurrentBranch(currentBr);
      } catch (err) {
        console.error("Failed to fetch branches:", err);
        toast.error("Failed to load branches");
      }
    };

    fetchBranches();
  }, [project?.id]);

  // 2. Load root files when branch changes
  useEffect(() => {
    if (!project?.id || !currentBranch || isBranchSwitching) return;
    loadFilesInDirectory(null);
  }, [currentBranch]);

  // 3. Socket listeners for branch switching
  useEffect(() => {
    if (!socket) return;

    socket.on("project-reloading", () => {
      setIsBranchSwitching(true);
    });

    socket.on("project-reloaded", (data) => {
      setIsBranchSwitching(false);
      setPathStack([]);
      setCurrentPath("/");
      if (data?.files) {
        setFilesInView(data.files);
      }
      toast.success("Branch switched successfully");
    });

    return () => {
      socket.off("project-reloading");
      socket.off("project-reloaded");
    };
  }, [socket]);

  // Load files from backend
  const loadFilesInDirectory = async (parentFileMetaId = null) => {
    setIsLoading(true);
    try {
      if (parentFileMetaId === null) {
        // Load root files
        const res = await axios.get(
          `http://localhost:3000/api/explorer/tree?projectId=${project.id}`,
          { withCredentials: true }
        );
        setFilesInView(res.data.data || []);
        setCurrentPath("/");
        setPathStack([]);
      } else {
        // Load folder contents
        const res = await axios.get(
          `http://localhost:3000/api/explorer/subtree/folder/${parentFileMetaId}`,
          { withCredentials: true }
        );
        setFilesInView(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load directory:", err);
      toast.error("Failed to load folder contents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranchSwitch = async (branchName) => {
    if (branchName === currentBranch) return;

    try {
      setIsBranchSwitching(true);
      await axios.post(
        `http://localhost:3000/api/git/${project.id}/switch-branch`,
        { branchName },
        { withCredentials: true }
      );

      // Emit to server so it broadcasts to other collaborators
      socket?.emit("branch-switch-start", {
        projectId: project.id,
        branch: branchName,
      });

      setCurrentBranch(branchName);
    } catch (err) {
      console.error("Branch switch failed:", err);
      toast.error(err.response?.data?.message || "Failed to switch branch");
      setIsBranchSwitching(false);
    }
  };

  const handleFolderOpen = (fileMetaId, folderName) => {
    // Add to path stack for breadcrumb later
    setPathStack((prev) => [...prev, { id: fileMetaId, name: folderName }]);
    
    // Load contents
    loadFilesInDirectory(fileMetaId);
    
    // Update display path
    const newPath = pathStack.length === 0 
      ? `/${folderName}` 
      : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
  };

  const handleBreadcrumbClick = (index) => {
    if (index === 0) {
      // Go to root
      setCurrentPath("/");
      setPathStack([]);
      loadFilesInDirectory(null);
    } else {
      // Go to specific folder in breadcrumb
      const newStack = pathStack.slice(0, index);
      setPathStack(newStack);
      
      const targetId = newStack[newStack.length - 1]?.id;
      if (targetId) {
        loadFilesInDirectory(targetId);
        const newPath = "/" + newStack.map(p => p.name).join("/");
        setCurrentPath(newPath);
      }
    }
  };

  const handleFileClick = (file) => {
    // Pass file selection to parent to open EditorPage
    onOpenEditor(file);
  };

  return (
    <div className="relative flex flex-col h-full bg-slate-950 text-slate-200">
      {/* Loading Overlay */}
      {isBranchSwitching && <LoadingOverlay message="Switching branch..." />}

      {/* Header */}
      <GitHeader
        projectName={project?.name}
        currentBranch={currentBranch}
        branches={branches}
        onBranchSwitch={handleBranchSwitch}
        onBack={onBackToDashboard}
        isLoading={isBranchSwitching}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <GitExplorer
          files={filesInView}
          currentPath={currentPath}
          pathStack={pathStack}
          onFolderOpen={handleFolderOpen}
          onBreadcrumbClick={handleBreadcrumbClick}
          onFileClick={handleFileClick}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
