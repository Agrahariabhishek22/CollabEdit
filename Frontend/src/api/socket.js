import { io } from "socket.io-client";

let socket = null;

export function initSocket() {
  if (socket?.connected) return socket;

  // Vite mein environment variables aise access hote hain
  // Yaad rakhna: Variable ka naam VITE_ se shuru hona zaroori hai
  const SOCKET_URL = import.meta.env.VITE_API_WS || "http://localhost:3000";

  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"], // Reconnection reliability ke liye dono rakho
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("🚀 Socket Connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Socket Connection Error:", err.message);
  });

  return socket;
}

export function getSocket() {
  // Agar socket object hai par connected nahi hai, toh reconnect karwao
  if (!socket || !socket.connected) {
    return initSocket();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket Disconnected");
  }
}