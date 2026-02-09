import React from "react";
import {
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import { UserPlus } from "lucide-react";

const FileTreeItem = ({
  item,
  level,
  selectedFile,
  onSelectFile,
  onFolderExpand,
  onContextMenu,
  onInviteClick,
}) => {
  const isSelected = selectedFile?.id === item.id;
  const isExpanded = item.isExpanded;

  const handleInteraction = (e) => {
    e.stopPropagation();
    if (item.isFolder) {
      onFolderExpand(item);
    } else {
      onSelectFile(item);
    }
  };

  return (
    <div className="w-full">
      {/* 1. Item Row */}
      <div
        onClick={handleInteraction}
        onContextMenu={(e) => {
          // VIEWER check: Menu prevent karo
          if (item.accessMode === "VIEWER") {
            e.preventDefault();
            return;
          }
          onContextMenu(e, item);
        }}
        style={{ paddingLeft: `${level * 12 + 16}px` }}
        className={`group flex items-center justify-between py-1.5 cursor-pointer transition-all border-l-[3px] duration-200 ${
          isSelected
            ? "bg-indigo-500/10 border-indigo-500 text-slate-100"
            : "border-transparent text-slate-500 hover:bg-slate-900/40 hover:text-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {item.isFolder ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
              >
                <ChevronDown
                  size={14}
                  className={isExpanded ? "text-indigo-400" : "text-slate-600"}
                />
              </span>
              <span
                className={isExpanded ? "text-indigo-400" : "text-slate-500"}
              >
                {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
              </span>
            </div>
          ) : (
            <FileCode
              size={16}
              className={isSelected ? "text-indigo-400" : "text-slate-600"}
            />
          )}

          <span className="text-[11.5px] font-bold truncate tracking-tight">
            {item.name}
          </span>
        </div>

        {/* Invite Button - Visible on Hover */}
        <div className="flex items-center gap-2 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => {
              console.log(item);
              
              e.stopPropagation();
              onInviteClick(item);
            }}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <UserPlus size={13} />
          </button>
        </div>

      </div>

      {/* 2. Nested Sub-Tree (Tailwind Animation) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {item.isFolder &&
          item.children &&
          item.children.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              onFolderExpand={onFolderExpand}
              onContextMenu={onContextMenu}
              onInviteClick={onInviteClick}
            />
          ))}
      </div>
    </div>
  );
};

export default FileTreeItem;
