import React, { useState, useEffect, useCallback, useRef } from "react";
import EditorHeader from "../components/Editor/EditorHeader/EditorHeader";
// import ChatPanel from "../components/ChatPanel";
import toast from "react-hot-toast";
import { useSocket } from "../hooks/useSocket";
import { EditorProvider } from "../context/EditorContext";
import EditorCore from "../components/Editor/EditorCore/EditorCore";
import { ArrowLeft } from "lucide-react";

export default function EditorPage({
  selectedFile,
  projectId,
  isGitMode = false,
  onBack = null,
}) {
  const { socket } = useSocket();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Real-time State
  const [accessMode, setAccessMode] = useState("VIEWER");
  const [participants, setParticipants] = useState([]);
  const [initialBinary, setInitialBinary] = useState(null);

  // 1. Handle File Connection (The Handshake)
  useEffect(() => {
    console.log(selectedFile);

    if (!selectedFile?.id || !socket) return;

    setIsLoading(true);
    const timeout = setTimeout(() => {
      setIsLoading(false);
      console.warn("Socket response timed out, forcing editor to load");
    }, 2000); // 2 seconds wait karo

    // Request to join the file room & rehydrate Shadow Doc
    socket.emit("file:join", {
      fileId: selectedFile.id,
      projectId: projectId,
    });

    // Listen for successful join
    socket.on("file:joined", (data) => {
      setAccessMode(data.accessMode);
      // 🟢 FIX: Agar server object bhej raha hai { id: {user} },
      // toh usey array [ {user}, {user} ] mein convert karo
      const participantsArray = data.participants
        ? Object.values(data.participants)
        : [];
      setParticipants(participantsArray);
      setInitialBinary(data.initialState); // Binary state for Yj//s
      setIsLoading(false);
      console.log(
        `[Collab] Joined ${data.fileId} as ${data.accessMode} data is ${data.initialState}`,
      );
      console.log("Binary as Typed Array:", new Uint8Array(data.initialState));
      console.log("[Editorr page] these are participants", data.participants);
      socket.emit("ast:request-tree", { fileId: data.fileId });

    });

    // Listen for join errors (e.g., Permission Denied)
    socket.on("file:join-error", (err) => {
      toast.error(err.message || "Access Denied");
      setIsLoading(false);
    });

    // 2. Presence Listeners: Jab naya banda join kare
    socket.on("user:joined", ({ user }) => {
      console.log("New participant joined:", user);
      setParticipants((prev) => {
        // Array of objects mein filter/find kaam karega
        const exists = prev.find((p) => p.userId === user.userId);
        if (exists) return prev;
        return [...prev, user];
      });
      console.log(user);

      toast(`${user.userName} joined`, { icon: "👋" });
    });

    // 3. Presence Listeners: Jab koi left kare
    socket.on("user:left", ({ userId }) => {
      console.log("Participant left:", userId);
      setParticipants((prev) => {
        // Ab ye array hai, toh .filter makkhan chalega!
        return prev.filter((p) => p.userId !== userId);
      });
    });

    // Cleanup: Jab file switch ho ya component unmount ho
    return () => {
      clearTimeout(timeout);
      socket.emit("file:leave", { fileId: selectedFile.id });
      socket.off("file:joined");
      socket.off("file:join-error");
      socket.off("user:joined");
      socket.off("user:left");
    };
  }, [selectedFile?.id, socket, projectId]);

  const handleChatToggle = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);
  console.log(
    "Render Check -> isLoading:",
    isLoading,
    "selectedFile:",
    !!selectedFile,
    "initialBinary:",
    !!initialBinary,
  );
  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Git Mode Back Button */}
      {isGitMode && (
        <div className="flex items-center px-4 h-12 border-b border-slate-800/50 bg-slate-900/40">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            <span>Back to Files</span>
          </button>
        </div>
      )}

      {/* Editor Header: Ab participants bhi dikhayega (Avatars) */}
      <EditorHeader
        selectedFile={selectedFile}
        participants={participants}
        accessMode={accessMode}
        // onChatToggle={handleChatToggle}
        // isChatOpen={isChatOpen}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                {/* Loading Spinner */}
              </div>
            ) : (
              // ✅ Context yahan initialize ho raha hai
              <EditorProvider
                key={selectedFile.id}
                initialBinary={initialBinary}
                socket={socket}
                fileId={selectedFile.id}
              >
                <EditorCore
                  selectedFile={selectedFile}
                  accessMode={accessMode}
                  initialBinary={initialBinary}
                />
              </EditorProvider>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center opacity-20">
              {/* Empty State */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
