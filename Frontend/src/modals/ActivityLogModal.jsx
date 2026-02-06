import React, { useState, useEffect } from "react";
import { X, Clock, User } from "lucide-react";

export default function ActivityLogModal({ selectedFile, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityLog();
  }, [selectedFile?.id]);

  const fetchActivityLog = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      const response = await fetch(
        `/api/files/${selectedFile.id}/activity-log?limit=100`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOperationIcon = (opType) => {
    const iconMap = {
      STRUCTURAL_CHANGE: "🏗️",
      LOGIC_UPDATE: "🔧",
      CONFLICT: "⚠️",
    };
    return iconMap[opType] || "📝";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-2xl max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            Activity Log - Recent 100 Operations
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-slate-400">Loading activity log...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-slate-400">No activities recorded</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="px-6 py-4 hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-lg mt-1">
                      {getOperationIcon(activity.opType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-100">
                          {activity.userEmail}
                        </span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          {activity.opType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">
                        {activity.summary}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock size={12} />
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
