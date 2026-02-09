import React, { useEffect, useRef } from "react";
import axios from "axios";
import { FilePlus, FolderPlus, Edit3, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ContextMenu({ position, meta, onClose, onRefresh }) {
const menuRef = useRef(null); // Menu ka reference lene ke liye

  useEffect(() => {
    const handleOutsideClick = (e) => {
      // Agar click menu ke andar hua hai, toh kuch mat karo
      if (menuRef.current && menuRef.current.contains(e.target)) {
        return;
      }
      onClose();
    };

    // Chota sa delay (0ms) taaki opening event stack se nikal jaye
    const timeoutId = setTimeout(() => {
      window.addEventListener("mousedown", handleOutsideClick);
      window.addEventListener("contextmenu", handleOutsideClick);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("contextmenu", handleOutsideClick);
    };
  }, [onClose]);

  const menuItems = [
    {
      label: "New File",
      icon: <FilePlus size={14} />,
      action: "ADD_FILE",
      color: "text-slate-300",
    },
    {
      label: "New Folder",
      icon: <FolderPlus size={14} />,
      action: "ADD_FOLDER",
      color: "text-slate-300",
    },
    {
      label: "Rename",
      icon: <Edit3 size={14} />,
      action: "RENAME",
      color: "text-slate-300",
      border: true,
    },
    {
      label: "Delete",
      icon: <Trash2 size={14} />,
      action: "DELETE",
      color: "text-rose-400",
    },
  ];

  const handleAction = async (action) => {
    try {
      switch (action) {
        case "DELETE":
          if (window.confirm(`Bhai, pakka delete karna hai ${meta.name}?`)) {
            // Req Body: { fileMetaId, projectId }
            await axios.delete(`http://localhost:3000/api/files/delete`, {
              data: {
                fileMetaId: meta.id,
                projectId: meta.projectId,
              },
              withCredentials: true,
            });
            toast.success("File .trash mein bhej di gayi hai!");
            onRefresh();
          }
          break;

        case "ADD_FILE":
        case "ADD_FOLDER":
          const name = prompt(
            `Enter ${action === "ADD_FILE" ? "File" : "Folder"} name:`,
          );
          if (name) {
            // Req Body: { parentFileMetaId, projectId, name, isFolder, content }
            await axios.post(
              `http://localhost:3000/api/files/create`,
              {
                parentFileMetaId: meta.isFolder
                  ? meta.id
                  : meta.parentId || null,
                projectId: meta.projectId,
                name: name,
                isFolder: action === "ADD_FOLDER",
                content: "", // Default empty content for new files
              },
              { withCredentials: true },
            );

            toast.success(`${name} created!`);
            onRefresh();
          }
          break;

        case "RENAME":
          const newName = prompt("Enter new name:", meta.name);
          if (newName && newName !== meta.name) {
            // Req Body: { fileMetaId, projectId, newName }
            // Endpoint: PATCH /api/files/rename
            await axios.patch(
              `http://localhost:3000/api/files/rename`,
              {
                fileMetaId: meta.id,
                projectId: meta.projectId,
                newName: newName,
              },
              { withCredentials: true },
            );

            toast.success("Rename successful!");
            onRefresh();
          }
          break;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Locha ho gaya backend par!");
    } finally {
      onClose();
    }
  };

  return (
    <div
    ref={menuRef} // Ye ref zaroori hai
      className="fixed z-[9999] w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()} // Menu ke andar click karne par menu band na ho
    >
      {menuItems.map((item, idx) => (
        <button
          key={idx}
          onClick={() => handleAction(item.action)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] font-bold transition-colors hover:bg-indigo-600/20 ${item.color} ${item.border ? "border-b border-slate-800 mb-1" : ""}`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
