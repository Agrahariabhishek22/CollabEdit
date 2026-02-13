import React from "react";

export default function EditorHeader({
  selectedFile,
  participants = [], // Array of objects
  accessMode,
  // editorContent,
  // onChatToggle,
  // isChatOpen,
}) {
  
  // 🟢 Helper function avatar ke liye (First letter of username)
  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  // 🟢 Random background colors avatars ke liye
  const avatarColors = [
    "bg-blue-500", "bg-purple-500", "bg-emerald-500", 
    "bg-amber-500", "bg-pink-500", "bg-indigo-500"
  ];

  const getAvatarColor = (id) => {
    // Id ke basis par consistent color choose karna
    const charCode = id ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    return avatarColors[charCode % avatarColors.length];
  };

  return (
    <div className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-4">
      {/* Left Section: Checkpoint & Activity */}
      <div className="flex items-center gap-3">
        {/* {selectedFile?.id && ( 
             <>
             <CheckpointDropdown selectedFile={selectedFile} />
             <ActivityLogButton selectedFile={selectedFile} />
           </>
         )} */}
      </div>

      {/* Middle Section: File Info */}
      {selectedFile?.id && (
        <div className="flex-1 flex items-center gap-2 px-4 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-lg min-w-0 max-w-md">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm font-semibold text-slate-100 truncate">
            {selectedFile.name}
          </span>
          {selectedFile.sourceType === "GIT" && (
            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              GIT
            </span>
          )}
        </div>
      )}

      {/* Right Section: Avatars & Chat Toggle */}
      <div className="flex items-center gap-6">
        {/* 🟢 Participant Avatars Logic (Google Docs Style) */}
        <div className="flex items-center -space-x-2 overflow-hidden">
          {participants.slice(0, 4).map((p, idx) => (
            <div
              key={p.userId || idx}
              title={`${p.userEmail} (${p.accessMode})`}
              className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border-2 border-slate-900 ${getAvatarColor(p.userId)} text-white shadow-lg transition-transform hover:z-10 hover:scale-110 cursor-default`}
            >
              <span className="text-xs font-bold">{getInitial(p.userEmail)}</span>
              {/* Active indicator dot */}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-slate-900" />
            </div>
          ))}

          {/* More than 4 participants */}
          {participants.length > 4 && (
            <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-700 text-slate-300 text-[10px] font-bold z-0">
              +{participants.length - 4}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* {selectedFile?.id && (
            <>
              <SaveButton
                selectedFile={selectedFile}
                editorContent={editorContent}
              />

              <LiveCollaborators
                projectId={selectedFile.projectId}
                fileId={selectedFile.id}
              />

              <ChatToggleButton isOpen={isChatOpen} onToggle={onChatToggle} />
            </>
          )} */}
        </div>
      </div>
    </div>
  );
}