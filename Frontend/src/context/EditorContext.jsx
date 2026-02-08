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
      console.log("[handle remote update] inside editor context",update);

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
  useEffect(() => {
    if (!socket) return;

    // Listen for cursor updates from other users
    const handleCursorUpdate = ({ userId, userName, cursor, color }) => {
      setAwarenessStates((prev) => {
        const filtered = prev.filter((state) => state.userId !== userId);
        return [...filtered, { userId, userName, cursor, color }];
      });
    };

    socket.on("cursor:update", handleCursorUpdate);

    return () => {
      socket.off("cursor:update", handleCursorUpdate);
    };
  }, [socket]);

  // Send local cursor updates
  const updateCursor = (line, column) => {
    if (!socket) return;

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
