import React, { useState } from "react";
import { ClipboardList } from "lucide-react";
import ActivityLogModal from "../../../modals/ActivityLogModal";

export default function ActivityLogButton({ selectedFile }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!selectedFile?.id) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm transition-colors"
        title="View activity log (recent 100 operations)"
      >
        <ClipboardList size={16} />
        <span>Activity</span>
      </button>

      {isModalOpen && (
        <ActivityLogModal
          selectedFile={selectedFile}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
