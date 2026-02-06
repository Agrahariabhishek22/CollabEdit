import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";

export default function ChatToggleButton({ isOpen, onToggle }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const handleToggle = () => {
    onToggle();
    // Reset unread count when opening
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`relative flex items-center gap-1 px-3 py-2 rounded-md text-sm transition-colors ${
        isOpen
          ? "bg-blue-600 text-white"
          : "bg-slate-800 hover:bg-slate-700 text-slate-200"
      }`}
      title={isOpen ? "Close chat" : "Open chat"}
    >
      {isOpen ? <X size={16} /> : <MessageCircle size={16} />}
      <span>{isOpen ? "Close" : "Chat"}</span>

      {!isOpen && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
