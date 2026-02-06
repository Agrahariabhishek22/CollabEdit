import React, { createContext, useEffect, useState, useCallback } from "react";
import io from "socket.io-client";
import Cookies from 'js-cookie';
export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    // TODO: Replace with actual backend URL
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

    const newSocket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      withCredentials:true,
    //   auth: {
    //     // Yahan "token" aapki cookie ka naam hona chahiye jo server se set hua hai
    //     token: Cookies.get("token"),
    //   },
    });
    console.log(cookieStore.get("token"));
    

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
