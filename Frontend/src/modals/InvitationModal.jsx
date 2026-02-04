import React, { useState, useEffect } from "react";
import { X, UserPlus, Shield, Trash2, Loader2, Mail, Plus } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";

export default function InvitationModal({ resource, onClose }) {
  const [loading, setLoading] = useState(true);
  const [collabs, setCollabs] = useState([]); 
  const [newEmail, setNewEmail] = useState("");
  const [newMode, setNewMode] = useState("VIEWER");
  const [delta, setDelta] = useState([]); 

  // Get current user email from localStorage
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userAccess = resource.accessMode;

  useEffect(() => {
    fetchCollaborators();
  }, [resource.id]);

  const fetchCollaborators = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/invitations/${resource.id}/collaborators`,
        { withCredentials: true }
      );
      const list = [
        { email: res.data.collaborators.admin.email, mode: "ADMIN", isOwner: true },
        ...res.data.collaborators.editors.map((u) => ({ email: u.email, mode: "EDITOR" })),
        ...res.data.collaborators.viewers.map((u) => ({ email: u.email, mode: "VIEWER" })),
      ];
      setCollabs(list);
    } catch (err) {
      toast.error("Failed to load collaborators");
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Handle Self Revoke ---
  const handleSelfRevoke = async () => {
    if (!window.confirm("Are you sure you want to leave this project?")) return;

    try {
      setLoading(true);
      // Directly hitting the self-revoke endpoint
      await axios.post(
        `http://localhost:3000/api/invitations/revoke/${resource.id}`,
        {},
        { withCredentials: true }
      );
      toast.success("Access revoked successfully");
      onClose(); // Close modal immediately as user no longer has access
      // Optional: window.location.reload() or refresh sidebar
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to self-revoke");
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (email, prevMode, nextMode) => {
    setCollabs((prev) =>
      prev.map((c) => (c.email === email ? { ...c, mode: nextMode } : c))
    );

    setDelta((prev) => {
      const existing = prev.find((d) => d.email === email);
      if (existing) {
        return prev.map((d) =>
          d.email === email ? { ...d, modified_mode: nextMode } : d
        );
      }
      return [...prev, { email, previous_mode: prevMode, modified_mode: nextMode }];
    });
  };

  const addNewInvite = () => {
    if (!newEmail) return;
    setCollabs((prev) => [...prev, { email: newEmail, mode: newMode, isNew: true }]);
    setDelta((prev) => [...prev, { email: newEmail, previous_mode: null, modified_mode: newMode }]);
    setNewEmail("");
  };

  const saveChanges = async () => {
    try {
      await axios.post(
        `http://localhost:3000/api/invitations/${resource.id}/invite`,
        delta,
        { withCredentials: true }
      );
      toast.success("Invitations processed");
      onClose();
    } catch (err) {
      toast.error("Failed to send invitations");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Access Control: {resource.name}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Admin Tools */}
          {userAccess === "ADMIN" && (
            <div className="flex gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="bg-transparent text-xs flex-1 outline-none px-2 text-slate-200"
              />
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value)}
                className="bg-slate-800 text-[10px] font-bold px-2 py-1 rounded border-none outline-none text-indigo-400"
              >
                <option value="EDITOR">EDITOR</option>
                <option value="VIEWER">VIEWER</option>
              </select>
              <button onClick={addNewInvite} className="bg-indigo-600 hover:bg-indigo-500 p-1.5 rounded transition-colors">
                <Plus size={16} />
              </button>
            </div>
          )}

          {/* Collaborators List */}
          <div className="space-y-2">
            {loading ? (
              <Loader2 className="animate-spin mx-auto text-slate-600" />
            ) : (
              collabs.map((c) => (
                <div key={c.email} className="flex items-center justify-between p-2.5 bg-slate-800/30 rounded-lg border border-slate-800/50 group transition-all hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      {c.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-bold truncate ${c.email === currentUser.email ? "text-indigo-400" : "text-slate-200"}`}>
                        {c.email} {c.email === currentUser.email && "(You)"}
                      </p>
                      <p className="text-[9px] text-slate-500 font-black tracking-tighter uppercase">{c.mode}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  {c.isOwner ? (
                    <Shield size={14} className="text-emerald-500 mr-2" />
                  ) : userAccess === "ADMIN" ? (
                    <select
                      value={c.mode}
                      onChange={(e) => handleModeChange(c.email, c.mode, e.target.value)}
                      className="bg-slate-900 text-[10px] font-bold px-2 py-1 rounded outline-none text-slate-400 focus:text-indigo-400"
                    >
                      <option value="EDITOR">EDITOR</option>
                      <option value="VIEWER">VIEWER</option>
                      <option value="REVOKE">REVOKE ACCESS</option>
                    </select>
                  ) : (
                    // Self Revoke Button for Non-Admins
                    c.email === currentUser.email && (
                      <button
                        onClick={handleSelfRevoke}
                        className="text-[10px] font-black text-rose-500 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all uppercase tracking-tight"
                      >
                        Leave Project
                      </button>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/50 flex justify-between items-center">
          <p className="text-[9px] text-slate-500 max-w-[200px] leading-tight">
            {userAccess === "ADMIN" 
              ? "Bhai, changes save krna mat bhulna." 
              : "You can only revoke your own access."}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase">
              Cancel
            </button>
            {userAccess === "ADMIN" && (
              <button
                disabled={delta.length === 0}
                onClick={saveChanges}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-[11px] font-black px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/10"
              >
                SAVE ACCESS
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}