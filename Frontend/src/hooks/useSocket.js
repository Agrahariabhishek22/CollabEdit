import { useContext } from "react";
import { SocketContext } from "../context/SocketContext";

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    console.warn(
      "useSocket hook used outside SocketProvider. Ensure SocketProvider wraps your app."
    );
    return { socket: null };
  }
  return context;
};
