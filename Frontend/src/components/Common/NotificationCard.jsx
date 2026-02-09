import React from "react";
import { formatDistanceToNow } from "date-fns";

// components/NotificationCard.jsx
export default function NotificationCard({ notification, onClick }) {
  const { type, message, sender, createdAt, status } = notification;

  // JSON parsing logic for formatted messages
  const meta = React.useMemo(() => {
    try { return JSON.parse(message); } 
    catch (e) { return { text: message }; }
  }, [message]);

  return (
    <div
      onClick={() => onClick(notification)}
      className="flex items-start gap-4 p-4 rounded-xl hover:bg-slate-800/40 cursor-pointer border border-transparent hover:border-slate-800 transition-all group"
    >
      <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
        {sender?.name?.[0] || "S"}
      </div>

      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className="text-xs font-black text-white uppercase tracking-tighter">
            {type === 'INVITE' ? `INVITATION FROM ${sender?.name}` : type}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </span>
        </div>
        
        <p className="text-[13px] text-slate-400 mt-1 leading-snug">
          {meta.resourceName ? (
            <>Wants to collaborate on <span className="text-indigo-400 font-bold">{meta.resourceName}</span> as <span className="uppercase text-[11px] text-slate-200">[{meta.mode}]</span></>
          ) : meta.text}
        </p>

        {status === "PENDING" && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Action Required</span>
          </div>
        )}
      </div>
    </div>
  );
}
