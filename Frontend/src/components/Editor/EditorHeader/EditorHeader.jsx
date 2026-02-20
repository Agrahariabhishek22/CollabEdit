import React, { useState, useEffect } from "react";

export default function EditorHeader({
  selectedFile,
  participants = [], // Array of objects [{userId, userEmail, userName, accessMode}]
  accessMode,
}) {
  console.log(participants);
  
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // 🟢 Local Storage se current user ki ID nikalna
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user && user.id) {
        setCurrentUserId(user.id);
      }
    } catch (err) {
      console.error("Error fetching user from local storage", err);
    }
  }, []);

  // 🟢 Helper function avatar ke liye (First letter of email/name)
  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "?");

  // 🟢 Random background colors avatars ke liye
  const avatarColors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];

  const getAvatarColor = (id) => {
    const charCode = id
      ? id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : 0;
    return avatarColors[charCode % avatarColors.length];
  };

  return (
    <div className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-4 relative">
      {/* Left Section: Checkpoint & Activity */}
      <div className="flex items-center gap-3">
        {/* Comments preserved: Checkpoint & Activity logic can go here */}
      </div>

      {/* Middle Section: File Info */}
      {selectedFile?.id && (
        <div className="flex-1 flex items-center gap-2 px-4 py-1.5 bg-slate-800/40 border border-slate-700/50 rounded-lg min-w-0 max-w-md">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-slate-100 truncate">
            {selectedFile.name}
          </span>
          {selectedFile.sourceType === "GIT" && (
            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              GIT
            </span>
          )}
        </div>
      )}

      {/* Right Section: Avatars & Collaboration */}
      <div className="flex items-center gap-6">
        {/* 🟢 Participant Avatars Stack */}
        <div className="flex items-center relative">
          <div className="flex items-center -space-x-2 overflow-hidden mr-2">
            {participants.slice(0, 5).map((p, idx) => {
              // 🟢 Pehle data nikal lo taaki undefined na aaye
              const name = p.userName || "Collaborator";
              const email = p.userEmail || "No email";
              const role = p.accessMode || "Viewer";
              const isMe = p.userId === currentUserId;

              return (
                <div
                  key={p.userId || idx}
                  // 🟢 FIX: Yahan sirf kaam ki info rakhi hai, ID nikaal di hai
                  title={`${name}${isMe ? " (You)" : ""}\nEmail: ${email}\nRole: ${role}`}
                  className={`relative group inline-flex items-center justify-center h-8 w-8 rounded-full border-2 border-slate-900 ${getAvatarColor(p.userId)} text-white shadow-lg transition-all hover:z-20 hover:scale-110 cursor-pointer`}
                >
                  <span className="text-xs font-bold">{getInitial(name)}</span>

                  {/* Active indicator dot */}
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 border border-slate-900" />

                  {/* 🟢 Custom Popup (Optional: Agar browser tooltip ke alawa chhota label chahiye) */}
                  <div className="absolute top-10 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-50 border border-slate-700 shadow-xl pointer-events-none transition-opacity">
                    {name} {isMe && "(You)"}
                  </div>
                </div>
              );
            })}

            {/* More than 5 participants toggle */}
            {participants.length > 5 && (
              <button
                onClick={() => setShowAllParticipants(!showAllParticipants)}
                className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-700 text-slate-300 text-[10px] font-bold z-10 hover:bg-slate-600 transition-colors"
              >
                +{participants.length - 5}
              </button>
            )}
          </div>

          {/* 🟢 View All Participants Dropdown */}
          {showAllParticipants && (
            <div className="absolute right-0 top-12 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 py-2 max-h-60 overflow-y-auto custom-scrollbar">
              <div className="px-3 py-1 border-b border-slate-700 mb-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  All Collaborators
                </span>
              </div>
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/50 transition-colors"
                >
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(p.userId)}`}
                  >
                    {getInitial(p.userName || p.userEmail)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs text-slate-100 truncate font-medium">
                      {p.userName || p.userEmail}{" "}
                      {p.userId === currentUserId && (
                        <span className="text-blue-400">(You)</span>
                      )}
                    </span>
                    <span className="text-[9px] text-slate-400 truncate">
                      {p.userEmail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Comments preserved for Save, LiveCollaborators, and Chat toggle components */}
        </div>
      </div>
    </div>
  );
}
