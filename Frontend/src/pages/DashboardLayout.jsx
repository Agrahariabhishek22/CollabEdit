import React, { useState, useEffect } from "react";
import Sidebar from "../components/Common/Sidebar";
import EditorContainer from "../components/Common/EditorContainer";
import ContextMenu from "../components/Common/ContextMenu";
import HeaderStrip from "../components/Common/HeaderStrip";
import InvitationModal from "../modals/InvitationModal";
import EditorPage from "./EditorPage";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeView, setActiveView] = useState("EDITOR"); // "EDITOR" or "GIT_REPO"
  const [openTabs, setOpenTabs] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [unreadNotifs, setUnreadNotifs] = useState(3); // Example live sync state
  const [inviteResource, setInviteResource] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSidebarRefresh = () => {
    setRefreshTrigger((prev) => prev + 1); // Key change hote hi Sidebar remount/refetch karega
  };

  // Sidebar se file select hone par logic
  const handleFileSelect = (file) => {
    setSelectedFile(file);
    // Agar source GIT hai aur folder hai, toh REPO view dikhao
    if (file.sourceType === "GIT" && file.isFolder) {
      setActiveView("GIT_REPO");
    } else {
      setActiveView("EDITOR");
    }
  };

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen selection:bg-indigo-500/30 overflow-hidden">
      {/* 1. The Fixed Strip */}
      <HeaderStrip
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        unreadCount={unreadNotifs}
      />

      {/* 2. Main Content Area */}
      <div className="flex h-[calc(100vh-64px)] mt-16 transition-all duration-300 ease-in-out">
        {/* Sidebar with Live Sync Logic */}
        <div
          className={`transition-all duration-300 border-r border-slate-800/50 bg-slate-900/20 backdrop-blur-md
            ${sidebarOpen ? "w-auto" : "w-0 overflow-hidden border-none"}`}
        >
          <Sidebar
            key={refreshTrigger} // ✅ Key change hone par Sidebar ka useEffect dobara chalega
            onRefresh={handleSidebarRefresh}
            selectedFile={selectedFile}
            onSelectFile={handleFileSelect}
            onContextMenu={(e, meta) => {
              e.preventDefault();
              setContextMenu({ x: e.pageX, y: e.pageY, meta });
            }}
            onInviteClick={(meta) => setInviteResource(meta)}
          />
        </div>

        {/* Editor or Git Repo Dashboard */}
        <main className="flex-1 relative bg-slate-950">
          {/* <EditorContainer
            selectedFile={selectedFile}
            activeView={activeView}
            openTabs={openTabs}
            setOpenTabs={setOpenTabs}
          /> */}
          <EditorPage selectedFile={selectedFile} projectId={selectedFile?.projectId||null} />
        </main>
      </div>

      {/* 3. Global Context Menu Portal */}
      {contextMenu && (
        <ContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          meta={contextMenu.meta}
          onClose={() => setContextMenu(null)}
          onRefresh={handleSidebarRefresh}
        />
      )}
      {inviteResource && (
        <InvitationModal
          resource={inviteResource}
          onClose={() => setInviteResource(null)}
        />
      )}
    </div>
  );
}
