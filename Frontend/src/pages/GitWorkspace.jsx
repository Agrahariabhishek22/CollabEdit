import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../hooks/useSocket";
import GitHeader from "../components/Git/GitHeader";
import GitExplorer from "../components/Git/GitExplorer";
import LoadingOverlay from "../components/Git/LoadingOverlay";
import CommitModal from "../components/Git/CommitModal";
import CreateBranchModal from "../components/Git/CreateBranchModal";
import PushConfirmModal from "../components/Git/PushConfirmModal";
import HistoryModal from "../components/Git/HistoryModal";
import axios from "axios";
import { toast } from "react-toastify";

export default function GitWorkspace({
  project,
  onBackToDashboard,
  onOpenEditor,
  userRole = "VIEWER",
}) {
  // console.log(project);

  const { socket } = useSocket();
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(
    project?.currentBranch || "main",
  );
  const [filesInView, setFilesInView] = useState([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [pathStack, setPathStack] = useState([
    { id: project?.id, name: project?.name },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBranchSwitching, setIsBranchSwitching] = useState(false);
  const initialLoadRef = useRef(false);

  // Modal States
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [createBranchModalOpen, setCreateBranchModalOpen] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Operation Loading States
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // Collaborators tracking
  const [collaborators, setCollaborators] = useState({});

  // 1. Fetch branches on mount
  useEffect(() => {
    if (!project?.id || initialLoadRef.current) return;
    initialLoadRef.current = true;

    const fetchBranches = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3000/api/git/${project.projectId}/branches`,
          { withCredentials: true },
        );
        const branchList = res.data.branches || [];
        setBranches(branchList);

        // Set current branch from response or project
        const currentBr =
          res.data.currentBranch || project.currentBranch || "main";
        setCurrentBranch(currentBr);
      } catch (err) {
        console.error("Failed to fetch branches:", err);
        toast.error("Failed to load branches");
      }
    };

    fetchBranches();
  }, [project]);

  // 2. Load root files when branch changes
  useEffect(() => {
    if (!project?.id || !currentBranch || isBranchSwitching) return;
    loadFilesInDirectory(project.id);
  }, [currentBranch, project]);

  // 3. Socket listeners for branch switching and collaborators
  // useEffect(() => {
  //   if (!socket) return;

  //   socket.on("project-reloading", () => {
  //     setIsBranchSwitching(true);
  //   });

  //   socket.on("project-reloaded", (data) => {
  //     setIsBranchSwitching(false);
  //     setPathStack([]);
  //     setCurrentPath("/");
  //     if (data?.files) {
  //       setFilesInView(data.files);
  //     }
  //     toast.success("Branch switched successfully");
  //   });

  //   // Collaborator awareness
  //   socket.on("git:collaborators-update", (data) => {
  //     setCollaborators(data || {});
  //   });

  //   // Commit created notification
  //   socket.on("commit-created", (data) => {
  //     toast.info(`${data.author} committed: ${data.message}`);
  //   });

  //   // Branch created notification
  //   socket.on("branch-created", (data) => {
  //     toast.info(`New branch created: ${data.branch}`);
  //     // Refresh branches
  //     fetchBranchesInternal();
  //   });

  //   // Push complete notification
  //   socket.on("push-complete", (data) => {
  //     toast.success("Push completed successfully");
  //   });

  //   return () => {
  //     socket.off("project-reloading");
  //     socket.off("project-reloaded");
  //     socket.off("git:collaborators-update");
  //     socket.off("commit-created");
  //     socket.off("branch-created");
  //     socket.off("push-complete");
  //   };
  // }, [socket]);

  // Fetch branches (usable in effect)
  const fetchBranchesInternal = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/git/${project.projectId}/branches`,
        { withCredentials: true },
      );
      const branchList = res.data.data || [];
      setBranches(branchList);
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  };

  // Commit Handler
  const handleCommit = async ({ message, description, name, email }) => {
    setIsCommitting(true);
    let res;
    try {
      res = await axios.post(
        `http://localhost:3000/api/git/${project.projectId}/commit`,
        { message, description, name, email },
        { withCredentials: true },
      );

      // Emit to server for broadcast
      socket?.emit("git:commit-created", {
        projectId: project.projectId,
        message,
      });

      toast.success("Changes committed successfully");
    } catch (err) {
      console.error("Commit failed:", err);
      toast.error(res.data.message);
      throw err.response?.data?.message || "Failed to commit";
    } finally {
      setIsCommitting(false);
    }
  };

  // Create Branch Handler
  const handleCreateBranch = async (branchName) => {
    setIsCreatingBranch(true);
    try {
      await axios.post(
        `http://localhost:3000/api/git/${project.projectId}/create-branch`,
        { branchName, sourceBranch: currentBranch },
        { withCredentials: true },
      );

      // Emit to server for broadcast
      socket?.emit("git:branch-created", {
        projectId: project.id,
        branch: branchName,
      });

      toast.success("Branch created successfully");
      // Refresh branches
      fetchBranchesInternal();
      handleBranchSwitch(branchName);
    } catch (err) {
      console.error("Create branch failed:", err);
      throw err.response?.data?.message || "Failed to create branch";
    } finally {
      setIsCreatingBranch(false);
    }
  };

  // Push Handler
  const handlePush = async () => {
    setIsPushing(true);
    try {
      await axios.post(
        `http://localhost:3000/api/git/${project.id}/push`,
        { branch: currentBranch },
        { withCredentials: true },
      );

      // Emit to server for broadcast
      socket?.emit("git:push-complete", {
        projectId: project.id,
        branch: currentBranch,
      });

      toast.success("Pushed successfully");
    } catch (err) {
      console.error("Push failed:", err);
      throw err.response?.data?.message || "Failed to push";
    } finally {
      setIsPushing(false);
    }
  };

  // Load files from backend
  const loadFilesInDirectory = async (parentFileMetaId = null) => {
    setIsLoading(true);
    try {
      if (parentFileMetaId === null) {
        // Load root files
        const res = await axios.get(
          `http://localhost:3000/api/explorer/tree?projectId=${project.id}`,
          { withCredentials: true },
        );
        setFilesInView(res.data.data || []);
        setCurrentPath("/");
        setPathStack([]);
      } else {
        // Load folder contents
        const res = await axios.get(
          `http://localhost:3000/api/explorer/subtree/folder/${parentFileMetaId}`,
          { withCredentials: true },
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
        `http://localhost:3000/api/git/${project.projectId}/switch-branch`,
        { branchName },
        { withCredentials: true },
      );

      // Emit to server so it broadcasts to other collaborators
      socket?.emit("branch-switch-start", {
        projectId: project.projectId,
        branch: branchName,
      });

      setCurrentBranch(branchName);
    } catch (err) {
      console.error("Branch switch failed:", err);
      toast.error(err.response?.data?.message || "Failed to switch branch");
    } finally {
      setIsBranchSwitching(false);
    }
  };

  const handleFolderOpen = (fileMetaId, folderName) => {
    // Add to path stack for breadcrumb later
    setPathStack((prev) => [...prev, { id: fileMetaId, name: folderName }]);

    // Load contents
    loadFilesInDirectory(fileMetaId);

    // Update display path
    const newPath =
      pathStack.length === 0
        ? `/${folderName}`
        : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
  };

  const handleBreadcrumbClick = (index) => {
    if (index === 0) {
      return;
    } else {
      // Go to specific folder in breadcrumb
      const newStack = pathStack.slice(0, index);
      setPathStack(newStack);

      const targetId = newStack[newStack.length - 1]?.id;
      if (targetId) {
        loadFilesInDirectory(targetId);
        const newPath = "/" + newStack.map((p) => p.name).join("/");
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
        userRole={userRole}
        onCommitClick={() => setCommitModalOpen(true)}
        onCreateBranchClick={() => setCreateBranchModalOpen(true)}
        onPushClick={() => setPushModalOpen(true)}
        onHistoryClick={() => setHistoryModalOpen(true)}
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
          collaborators={collaborators}
        />
      </div>

      {/* Modals */}
      <CommitModal
        isOpen={commitModalOpen}
        onClose={() => setCommitModalOpen(false)}
        onCommit={handleCommit}
        isLoading={isCommitting}
      />

      <CreateBranchModal
        isOpen={createBranchModalOpen}
        onClose={() => setCreateBranchModalOpen(false)}
        onCreateBranch={handleCreateBranch}
        isLoading={isCreatingBranch}
        currentBranch={currentBranch}
      />

      <PushConfirmModal
        isOpen={pushModalOpen}
        onClose={() => setPushModalOpen(false)}
        onPush={handlePush}
        isLoading={isPushing}
        currentBranch={currentBranch}
      />

      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        projectId={project?.projectId}
        isLoading={false}
      />
    </div>
  );
}
