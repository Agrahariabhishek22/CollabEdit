import React, { useEffect, useMemo, useState } from "react";
import NotificationCard from "./NotificationCard";
import axios from "axios";
import {
  X,
  Check,
  Info,
  BellRing,
  ShieldCheck,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { createPortal } from "react-dom";

export default function NotificationPopover({ onClose }) {
  const [tab, setTab] = useState("PENDING");
  const [notifications, setNotifications] = useState({
    pending: [],
    archived: [],
  });
  const [loading, setLoading] = useState(false);

  // Modals State
  const [actionModal, setActionModal] = useState(null); // For Invites
  const [infoModal, setInfoModal] = useState(null); // For Read/Other notifs

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:3000/api/notifications", {
        withCredentials: true,
      });
      if (res?.data?.data) {
        setNotifications({
          pending: res.data.data.pending || [],
          archived: res.data.data.archived || [],
        });
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notification) {
    if (notification.status !== "PENDING") return;
    try {
      await axios.patch(
        `http://localhost:3000/api/notifications/${notification.id}/status`,
        { status: "READ" },
        { withCredentials: true },
      );
      // Local Move: Pending se hatao, Archived mein daalo
      setNotifications((prev) => ({
        pending: prev.pending.filter((n) => n.id !== notification.id),
        archived: [{ ...notification, status: "READ" }, ...prev.archived],
      }));
    } catch (err) {
      console.error("markAsRead error", err);
    }
  }

  async function handleNotificationClick(n) {
    const meta = JSON.parse(n.message || "{}");
    const enhancedNotif = { ...n, meta };

    // EDGE CASE: Check if invitation was revoked
    if (n.isRevoked && n.type === "INVITE_RECEIVED") {
      setInfoModal({
        ...enhancedNotif,
        revoked: true,
        title: "Invitation Revoked",
        message: "This invitation has been revoked by the sender.",
      });
      return;
    }

    if (tab === "PENDING") {
      // Mark as READ API call (Only for Pending)

      // Decide Modal based on type
      if (n.type === "INVITE_RECEIVED") {
        setActionModal(enhancedNotif);
      } else {
        setInfoModal(enhancedNotif);
      }
    } else {
      // Archived Tab: No API call, just show Info Modal
      setInfoModal(enhancedNotif);
    }
  }

  async function respondInvite(n, actionType) {
    try {
      // Backend: POST /api/invitations/respond/:notifId { action: 'ACCEPT' | 'DECLINE' }
      await axios.post(
        `http://localhost:3000/api/invitations/respond/${n.id}`,
        { action: actionType },
        { withCredentials: true },
      );
      // Success: Close modal
      setActionModal(null);
      await markAsRead(n);
    } catch (err) {
      console.error(`${actionType} failed`, err);
      alert(
        `Failed to ${actionType}: ${err.response?.data?.message || err.message}`,
      );
      setActionModal(null);
    }
  }

  const list =
    tab === "PENDING" ? notifications.pending : notifications.archived;

  return (
    <div className="absolute right-0 mt-2 w-[400px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-60 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-slate-950 p-1 rounded-xl">
          {["PENDING", "ARCHIVED"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t}{" "}
              {t === "PENDING" &&
                notifications.pending.length > 0 &&
                `(${notifications.pending.length})`}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs animate-pulse font-bold">
            FETCHING DATA...
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-slate-600 flex flex-col items-center gap-2">
            <BellRing size={32} className="opacity-20" />
            <p className="text-[10px] font-black uppercase">
              Workspace is quiet
            </p>
          </div>
        ) : (
          list.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onClick={handleNotificationClick}
            />
          ))
        )}
      </div>

      {/* --- ACTION MODAL (Invite Only) --- */}
      {/* --- ACTION MODAL (Invite Only) --- */}
      {actionModal && (
        <ModalWrapper onClose={() => setActionModal(null)}>
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
              <BellRing className="text-indigo-500" size={36} />
            </div>

            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
              New Collaboration
            </h3>

            <div className="mt-4 space-y-3">
              <p className="text-slate-400 text-xs leading-relaxed">
                <span className="text-indigo-400 font-bold">
                  {actionModal.sender?.name}
                </span>{" "}
                ({actionModal.sender?.email}) invited you to join:
              </p>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <span className="text-white font-black text-lg block truncate">
                  {actionModal.resourceName}
                </span>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded uppercase tracking-widest border border-indigo-500/20">
                    {actionModal.resourceType}
                  </span>
                  <span className="text-[9px] font-black px-2 py-0.5 bg-slate-800 text-slate-300 rounded uppercase tracking-widest border border-slate-700">
                    AS {actionModal.actionMode}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 w-full p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
              <p className="text-[9px] font-bold text-amber-500/80 uppercase tracking-tight text-center">
                Note: Accept to sync this with your local explorer grid.
              </p>
            </div>

            <div className="mt-8 flex w-full gap-3">
              <button
                onClick={() => respondInvite(actionModal, "DECLINE")}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 hover:border-rose-500/20"
              >
                Decline
              </button>
              <button
                onClick={() => respondInvite(actionModal, "ACCEPT")}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all border border-indigo-400/20"
              >
                Accept Invite
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* --- INFO MODAL (Dynamic Content based on Type) --- */}
      {infoModal && (
        <ModalWrapper
          onClose={async () => {
            setInfoModal(null);
            await markAsRead(infoModal);
          }}
        >
          <div className="flex flex-col items-center text-center">
            {/* Dynamic Icon Header */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border ${
                infoModal.type === "ACCESS_UPGRADED"
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : infoModal.type === "INVITE_RECEIVED" &&
                      infoModal.status === "DECLINED"
                    ? "bg-rose-500/10 border-rose-500/20"
                    : "bg-slate-800 border-slate-700"
              }`}
            >
              {infoModal.type === "ACCESS_UPGRADED" ? (
                <ShieldCheck className="text-emerald-500" size={30} />
              ) : infoModal.type === "COLLAB_JOINED" ? (
                <UserCheck className="text-indigo-500" size={30} />
              ) : (
                <Info className="text-slate-400" size={30} />
              )}
            </div>

            <h3
              className={`text-lg font-black uppercase tracking-tighter ${
                infoModal.type === "ACCESS_UPGRADED"
                  ? "text-emerald-400"
                  : "text-white"
              }`}
            >
              {infoModal.type?.replace(/_/g, " ")}
            </h3>

            <div className="mt-4 w-full bg-slate-950/50 border border-slate-800 p-5 rounded-2xl text-left">
              <div className="space-y-4">
                {/* Resource Detail */}
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Resource Context
                  </p>
                  <p className="text-sm font-bold text-slate-200">
                    {infoModal.resourceName}
                  </p>
                </div>

                {/* Upgrade Logic Visual */}
                {infoModal.type === "ACCESS_UPGRADED" && (
                  <div className="flex items-center gap-3 py-2 border-t border-slate-800">
                    <div className="text-[10px] font-black text-slate-500 line-through">
                      {infoModal.oldMode}
                    </div>
                    <ChevronRight size={14} className="text-slate-600" />
                    <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                      {infoModal.actionMode}
                    </div>
                  </div>
                )}

                {/* Status Badge for Declined/Accepted */}
                {infoModal.status !== "READ" &&
                  infoModal.status !== "PENDING" && (
                    <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Current Status
                      </p>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                          infoModal.status === "DECLINED"
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}
                      >
                        {infoModal.status}
                      </span>
                    </div>
                  )}

                {/* Raw Message */}
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[10px] text-slate-400 leading-relaxed italic">
                    "
                    {infoModal.meta?.message ||
                      infoModal.message ||
                      "No additional details provided."}
                    "
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setInfoModal(null)}
              className="mt-8 w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-700 shadow-xl"
            >
              Dismiss
            </button>
          </div>
        </ModalWrapper>
      )}
    </div>
  );
}

// Reusable Modal Wrapper for Elite Design
function ModalWrapper({ children, onClose }) {
  const modalContent = (
    // Backdrop: p-6 ko p-10 kiya aur items-start use karke thoda margin-top de sakte hain
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      {/* Modal Box: mt-20 ya mt-32 se ye top se niche aa jayega */}
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative mt-24 mb-10 animate-in zoom-in-95 slide-in-from-top-10 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-500 hover:text-white rounded-xl transition-all"
        >
          <X size={18} />
        </button>

        {children}
      </div>
    </div>
  );
  return createPortal(modalContent, document.body);
}
