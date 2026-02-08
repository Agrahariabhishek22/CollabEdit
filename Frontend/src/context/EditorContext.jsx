// context/EditorContext.jsx
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
} from "react";
import * as Y from "yjs";

export const EditorContext = createContext();

export const EditorProvider = ({ children, initialBinary, socket, fileId }) => {
  const [isReady, setIsReady] = useState(false);

  // ════════════════════════════════════════════════════════════
  // YJS SETUP (CRDT Document) - INITIALIZE TEXT FIRST!
  // ════════════════════════════════════════════════════════════
  const ydoc = useMemo(() => new Y.Doc(), []);
  // 🟢 FIX: Create ytext IMMEDIATELY (not in hydration effect)
  const ytext = useMemo(() => ydoc.getText("content"), [ydoc]);

  // ════════════════════════════════════════════════════════════
  // AWARENESS (For collaborative cursors)
  // ════════════════════════════════════════════════════════════
  const [awarenessStates, setAwarenessStates] = useState([]);

  // ════════════════════════════════════════════════════════════
  // 1. HYDRATION: Apply initial binary state from backend
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!initialBinary || isReady) return;

    try {
      const update = new Uint8Array(initialBinary);

      console.log("[DEBUG] Binary size:", update.length);
      console.log("[DEBUG] First 10 bytes:", Array.from(update.slice(0, 10)));
      // console.log("[DEBUG] ydoc before:", ydoc.share.get("content").toString());

      // Try to apply
      Y.applyUpdate(ydoc, update, "remote");

      // console.log("[DEBUG] ydoc after:", ydoc.share.get("content").toString());
      // console.log("[DEBUG] ytext toString():", ytext.toString());
      // console.log("[DEBUG] ydoc.share:", ydoc.share);

      setIsReady(true);
    } catch (err) {
      console.error("[ERROR] Hydration failed:", err);
      console.error("[ERROR] Stack:", err.stack);
      setIsReady(true);
    }
  }, [initialBinary, ydoc, ytext]);

  // ════════════════════════════════════════════════════════════
  // 2. OUTGOING UPDATES: When local user types
  // ════════════════════════════════════════════════════════════
  // EditorContext.jsx में DELTA:

  useEffect(() => {
    const updateHandler = (update, origin) => {
      // Only send if change is local (not from remote)
      if (origin !== "remote" && socket) {
        console.log("[EditorContext] Sending local update to backend");
        console.log("[Update bytes:", update.length);

        // 🟢 Convert Uint8Array to Array for Socket.io
        const updateArray = Array.from(update);

        socket.emit("yjs:update", {
          fileId,
          update: updateArray, // ← Send as Array
        });
      }
    };

    ydoc.on("update", updateHandler);

    return () => {
      ydoc.off("update", updateHandler);
    };
  }, [ydoc, socket, fileId]);

  // ════════════════════════════════════════════════════════════
  // 3. INCOMING UPDATES: When other users type
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!socket) return;

    const handleRemoteUpdate = ({ update, userId, userName }) => {
      console.log("[EditorContext] Received remote update from:", userName);

      // 🟢 FIX: Socket.io backend se binary (Buffer/ArrayBuffer) bhej raha hai
      // Use Uint8Array mein lapeto taaki Yjs samajh sake

      const binaryUpdate = new Uint8Array(update);
      console.log("[handle remote update] inside editor context", update);

      // Apply with "remote" origin to prevent echo
      try {
        Y.applyUpdate(ydoc, binaryUpdate, "remote");
      } catch (err) {
        console.error("[EditorContext] Remote update failed:", err);
      }
    };

    socket.on("yjs:update", handleRemoteUpdate);

    return () => {
      socket.off("yjs:update", handleRemoteUpdate);
    };
  }, [socket, ydoc]);

  // ════════════════════════════════════════════════════════════
  // 4. AWARENESS: Collaborative cursors
  // ════════════════════════════════════════════════════════════
  const CURSOR_COLORS = [
    "#FF5733",
    "#33FF57",
    "#3357FF",
    "#F333FF",
    "#FFB833",
    "#33FFF3",
    "#FF3380",
    "#8C33FF",
  ];
  // Helper: UserId se consistently ek hi color nikalne ke liye
  const getColorForUser = (userId) => {
    // Simple hash logic: userId ke characters ka sum le lo
    let hash = 0;
    if (!userId) return CURSOR_COLORS[0];
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % CURSOR_COLORS.length;
    return CURSOR_COLORS[index];
  };
  useEffect(() => {
    if (!socket) return;

    const handleCursorUpdate = ({ userId, userName, cursor }) => {
      // 1. Agar data valid nahi hai toh skip karo
      if (!userId || !cursor) return;

      const userColor = getColorForUser(userId);

      setAwarenessStates((prev) => {
        // 2. Purani state mein se is specific user ko dhoondo aur hatao (Filter)
        const otherUsers = prev.filter((u) => u.userId !== userId);

        // 3. Naya data add kar do
        return [
          ...otherUsers,
          {
            userId,
            userName: userName || "Anonymous",
            cursor,
            color: userColor,
          },
        ];
      });
    };

    socket.on("cursor:update", handleCursorUpdate);

    return () => {
      socket.off("cursor:update", handleCursorUpdate);
    };
  }, [socket]);

  // 4. Debugging ke liye alag useEffect (taaki hamesha latest state dikhe)
  useEffect(() => {
    if (awarenessStates.length > 0) {
      console.log("[Awareness] Current Collabs:", awarenessStates);
    }
  }, [awarenessStates]);

  // Send local cursor updates
  const updateCursor = (line, column) => {
    if (!socket) return;
    console.log("[EditorContext] Sending cursor update:", line, column);
    socket.emit("cursor:update", {
      fileId,
      cursor: { line, column },
    });
  };

  const value = {
    ydoc,
    ytext,
    socket,
    fileId,
    awarenessStates,
    updateCursor,
    isReady,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};
