import React from "react";
import {
  Folder,
  File,
  ChevronRight,
  Loader2,
  Home,
} from "lucide-react";
import CollaboratorBadge from "./CollaboratorBadge";

export default function GitExplorer({
  files,
  currentPath,
  pathStack = [],
  onFolderOpen,
  onBreadcrumbClick,
  onFileClick,
  isLoading,
  collaborators = {}, // Map of fileId -> array of collaborators
}) {
  // Generate breadcrumb items from pathStack
  const getBreadcrumbs = () => {
    if (pathStack.length === 0) return [{ name: "Root", index: 0 }];
    return [
      { name: "Root", index: 0 },
      ...pathStack.map((item, idx) => ({ name: item.name, index: idx + 1 })),
    ];
  };

  const breadcrumbs = getBreadcrumbs();

  const getLanguageColor = (fileName) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const colorMap = {
      js: "text-yellow-400",
      jsx: "text-blue-400",
      ts: "text-blue-500",
      tsx: "text-blue-400",
      py: "text-green-400",
      java: "text-red-400",
      json: "text-yellow-300",
      md: "text-slate-400",
      html: "text-red-500",
      css: "text-blue-400",
      scss: "text-pink-400",
    };
    return colorMap[ext] || "text-slate-400";
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-800/50 bg-slate-900/20 flex-wrap">
        {breadcrumbs.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <button
              onClick={() => onBreadcrumbClick(item.index)}
              className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors text-sm"
            >
              {item.index === 0 ? (
                <Home size={14} />
              ) : (
                <span>{item.name}</span>
              )}
            </button>
            {idx < breadcrumbs.length - 1 && (
              <ChevronRight size={14} className="text-slate-600" />
            )}
          </div>
        ))}
      </div>

      {/* File/Folder List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Loader2 className="animate-spin text-indigo-500" size={24} />
            <span className="text-xs text-slate-500 font-medium">
              Loading files...
            </span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Folder size={24} className="text-slate-600" />
            <span className="text-sm text-slate-500 font-medium">
              Folder is empty
            </span>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/30">
            {/* Folders */}
            {files
              .filter((f) => f.isFolder)
              .map((file) => (
                <div
                  key={file.id}
                  onClick={() => onFolderOpen(file.id, file.name)}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  <Folder size={16} className="text-indigo-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors flex-1 truncate">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {collaborators[file.id] && (
                      <CollaboratorBadge collaborators={collaborators[file.id]} />
                    )}
                    <ChevronRight
                      size={14}
                      className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    />
                  </div>
                </div>
              ))}

            {/* Divider */}
            {files.some((f) => f.isFolder) && files.some((f) => !f.isFolder) && (
              <div className="h-px bg-slate-700/30" />
            )}

            {/* Files */}
            {files
              .filter((f) => !f.isFolder)
              .map((file) => (
                <div
                  key={file.id}
                  onClick={() => onFileClick(file)}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  <File
                    size={16}
                    className={`${getLanguageColor(file.name)} flex-shrink-0`}
                  />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors flex-1 truncate">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {collaborators[file.id] && (
                      <CollaboratorBadge collaborators={collaborators[file.id]} />
                    )}
                    <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0">
                      {file.name.split(".").pop()?.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
