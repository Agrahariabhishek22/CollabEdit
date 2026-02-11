import React from 'react';
import FileTreeItem from './FileTreeItem';

export default function FileTree({ items, selectedFile,setCurrentGitProject, onSelectFile, onFolderExpand, onContextMenu,onInviteClick }) {
  // Empty state handling
  if (!items || items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] leading-relaxed">
          Project Index Empty
        </p>
      </div>
    );
  }

  return (
    <div className="py-2 flex flex-col">
      {items.map((item) => (
        <FileTreeItem
          key={item.id}
          item={item}
          level={0}
          selectedFile={selectedFile}
          setCurrentGitProject={setCurrentGitProject}
          onSelectFile={onSelectFile}
          onFolderExpand={onFolderExpand}
          onContextMenu={onContextMenu}
          onInviteClick={onInviteClick}
        />
      ))}
    </div>
  );
}