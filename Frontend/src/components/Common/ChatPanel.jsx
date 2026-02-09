import React, { useState, useEffect, useRef } from "react";
import { Send, Loader } from "lucide-react";
import { useSocket } from "../../hooks/useSocket";

export default function ChatPanel({ projectId, fileId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !projectId || !fileId) return;

    const handleChatHistory = (data) => {
      setMessages(data.messages || []);
    };

    const handleMessageReceived = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    const handleTypingIndicator = (data) => {
      if (data.isTyping) {
        setIsTyping(true);
        // Auto-hide typing indicator after 3 seconds
        setTimeout(() => setIsTyping(false), 3000);
      }
    };

    socket.on("chat:history", handleChatHistory);
    socket.on("chat:message-received", handleMessageReceived);
    socket.on("chat:typing", handleTypingIndicator);

    // Request chat history
    socket.emit("chat:get-history", { projectId, fileId });

    return () => {
      socket.off("chat:history", handleChatHistory);
      socket.off("chat:message-received", handleMessageReceived);
      socket.off("chat:typing", handleTypingIndicator);
    };
  }, [socket, projectId, fileId]);

  // Emit typing indicator
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue && socket && projectId && fileId) {
        socket.emit("chat:typing", {
          projectId,
          fileId,
          isTyping: false,
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [inputValue, socket, projectId, fileId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !socket || !projectId || !fileId) return;

    setIsSending(true);
    const message = inputValue.trim();
    setInputValue("");

    try {
      socket.emit("chat:send-message", {
        projectId,
        fileId,
        message,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-200">
          Collaboration Chat
        </h3>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-slate-500 text-sm">No messages yet</span>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id || msg.timestamp} className="text-sm">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-medium text-slate-200">
                    {msg.userEmail}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-slate-300 whitespace-pre-wrap break-words">
                  {msg.message}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <span>Someone is typing</span>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows="2"
            className="flex-1 bg-slate-800 text-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !inputValue.trim()}
            className={`flex items-center justify-center p-2 rounded transition-colors ${
              isSending || !inputValue.trim()
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {isSending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
