import React, { useState, useCallback } from "react";
import {
  CheckpointDropdown,
  ActivityLogButton,
  SaveButton,
  LiveCollaborators,
  ChatToggleButton,
} from "./index";

export default function EditorHeader({
  selectedFile,
  editorContent,
  onChatToggle,
  isChatOpen,
}) {
  return (
    <div className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-4">
      {/* Left Section: Checkpoint & Activity */}
      <div className="flex items-center gap-3">
        {selectedFile?.id && (
          <>
            <CheckpointDropdown selectedFile={selectedFile} />
            <ActivityLogButton selectedFile={selectedFile} />
          </>
        )}
      </div>

      {/* Middle Section: File Info */}
      {selectedFile?.id && (
        <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-slate-800/30 rounded-md min-w-0">
          <span className="text-sm font-medium text-slate-200 truncate">
            {selectedFile.name}
          </span>
          {selectedFile.sourceType === "GIT" && (
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded whitespace-nowrap">
              GIT
            </span>
          )}
        </div>
      )}

      {/* Right Section: Save, Collaborators, Chat */}
      <div className="flex items-center gap-3">
        {selectedFile?.id && (
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
        )}
      </div>
    </div>
  );
}
