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
        // console.log("[Update bytes:", update.length);

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
    "#E06C75", // Muted Soft Red (Chalky red, eyes par heavy nahi padta)
    "#98C379", // Sage Green (Classic dark mode green)
    "#61AFEF", // Steel Blue (Vibrant but professional)
    "#D19A66", // Soft Orange/Amber (Warm tone)
    "#56B6C2", // Deep Cyan/Teal (Oceanic feel)
    "#C678DD", // Soft Purple (Orchid style)
    "#E5C07B", // Muted Gold/Yellow (Warning/Highlight tone)
    "#4DB6AC", // Cool Pine (Alternative green/teal)
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
      // 1. Agar userId missing hai toh skip karo
      if (!userId) return;

      // 🟢 2. Cleanup Logic: Agar cursor null hai, toh user ko remove karo aur aage mat badho
      if (cursor === null) {
        setAwarenessStates((prev) => prev.filter((u) => u.userId !== userId));
        console.log(
          `[Cursor Update] Removed user ${userId} because cursor is null`,
        );
        return; // 👈 Yahan se return hona zaroori hai
      }

      // 3. Normal Logic: Agar cursor valid hai, toh existing user ko update/add karo
      const userColor = getColorForUser(userId);

      setAwarenessStates((prev) => {
        // Purani state mein se is specific user ko hatao taaki duplicate na ho
        const otherUsers = prev.filter((u) => u.userId !== userId);

        // Naya data add kar do
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
      // console.log("[Awareness] Current Collabs:", awarenessStates);
    }
  }, [awarenessStates]);

  // Send local cursor updates
  const updateCursor = (line, column) => {
    if (!socket) return;
    // console.log("[EditorContext] Sending cursor update:", line, column);
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
