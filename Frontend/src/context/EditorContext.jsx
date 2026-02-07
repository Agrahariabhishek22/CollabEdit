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
  // ════════════════════════════════════════════════════════════
  // YJS SETUP (CRDT Document)
  // ════════════════════════════════════════════════════════════
  const ydoc = useMemo(() => new Y.Doc(), []);
  const ytext = useMemo(() => ydoc.getText("content"), [ydoc]);

  // ════════════════════════════════════════════════════════════
  // AWARENESS (For collaborative cursors)
  // ════════════════════════════════════════════════════════════
  const [awarenessStates, setAwarenessStates] = useState([]);

  // ════════════════════════════════════════════════════════════
  // 1. HYDRATION: Apply initial binary state from backend
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    // ✅ FIX: ArrayBuffer ke liye byteLength check karein
    if (
      initialBinary &&
      (initialBinary.byteLength > 0 || initialBinary.length > 0)
    ) {
      console.log("[EditorContext] Applying initial binary state");
      // console.log(ytext);
      
      // Safety check: Agar already content hai toh dobara apply mat karo (Idempotency)
      if (ytext.toString().length === 0) {
        const update = new Uint8Array(initialBinary);
        Y.applyUpdate(ydoc, update);
        console.log(
          "[EditorContext] Hydration Complete. Length:",
          ytext.toString().length,
        );
      }
    }
  }, [initialBinary, ydoc, ytext]);

  // ════════════════════════════════════════════════════════════
  // 2. OUTGOING UPDATES: When local user types
  // ════════════════════════════════════════════════════════════
  useEffect(() => {
    const updateHandler = (update, origin) => {
      // Only send if change is local (not from remote)
      if (origin !== "remote" && socket) {
        console.log("[EditorContext] Sending local update to backend");
        socket.emit("yjs:update", {
          fileId,
          update: Array.from(update), // Convert Uint8Array to array
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
      const binaryUpdate = new Uint8Array(update);

      // Apply with "remote" origin to prevent echo
      Y.applyUpdate(ydoc, binaryUpdate, "remote");
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
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};
