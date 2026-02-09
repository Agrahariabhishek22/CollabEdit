import React from "react";
import { Loader2 } from "lucide-react";

export default function LoadingOverlay({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4 px-6 py-8 rounded-xl bg-slate-900/80 border border-slate-800 shadow-2xl">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <p className="text-sm font-medium text-slate-300 text-center">{message}</p>
      </div>
    </div>
  );
}
