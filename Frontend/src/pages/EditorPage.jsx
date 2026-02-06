import React, { useState, useEffect, useCallback } from "react";
import EditorHeader from "../components/Editor/EditorHeader/EditorHeader";
import { EditorCore } from "../components/Editor/EditorCore";
import ChatPanel from "../components/ChatPanel";

export default function EditorPage({ selectedFile, projectId }) {
  const [editorContent, setEditorContent] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load file content when selectedFile changes
  useEffect(() => {
    if (selectedFile?.id) {
      loadFileContent();
    }
  }, [selectedFile?.id]);

  const loadFileContent = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/files/${selectedFile.id}/content`, {
        withCredentials:true
      });
      if (response.ok) {
        const data = await response.json();
        setEditorContent(data.content || "");
      }
    } catch (error) {
      console.error("Failed to load file content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatToggle = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Editor Header */}
      <EditorHeader
        selectedFile={selectedFile}
        editorContent={editorContent}
        onChatToggle={handleChatToggle}
        isChatOpen={isChatOpen}
      />

      {/* Main Editor Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-slate-400">Loading file...</span>
                </div>
              ) : (
                <EditorCore
                  selectedFile={selectedFile}
                  editorContent={editorContent}
                  setEditorContent={setEditorContent}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-slate-500 text-lg">
                Select a file to start editing
              </span>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {/* {isChatOpen && (
          <ChatPanel projectId={projectId} fileId={selectedFile?.id} />
        )} */}
      </div>
    </div>
  );
}
