import React, { useState, useEffect } from 'react';
import { X, GitBranch, Save } from 'lucide-react';

export default function EditorContainer({
  selectedFile,
  activeView,
  openTabs,
  setOpenTabs,
}) {
  const [content, setContent] = useState('');
  const [branches, setBranches] = useState([]);

  // Add file to tabs
  useEffect(() => {
    if (selectedFile && selectedFile.type === 'file') {
      const existing = openTabs.find((t) => t.id === selectedFile.id);
      if (!existing) {
        setOpenTabs([...openTabs, selectedFile]);
      }
      // Placeholder: Fetch file content
      setContent(`// Content of ${selectedFile.name}\n// Loading...`);
    }
  }, [selectedFile]);

  const removeTab = (id) => {
    setOpenTabs(openTabs.filter((t) => t.id !== id));
  };

  return (
    <div className="flex-1 ml-64 flex flex-col bg-zinc-950">
      {/* Tabs Bar */}
      {openTabs.length > 0 ? (
        <div className="flex items-center gap-1 bg-zinc-900 border-b border-zinc-800 px-2 py-0 h-10 overflow-x-auto">
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t text-sm cursor-pointer transition ${
                selectedFile?.id === tab.id
                  ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              <span>{tab.name}</span>
              <button
                onClick={() => removeTab(tab.id)}
                className="hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 border-b border-zinc-800 h-10 flex items-center px-4 text-zinc-400 text-sm">
          No file open
        </div>
      )}

      {/* Editor/Git View Area */}
      <div className="flex-1 bg-zinc-950 overflow-hidden flex flex-col">
        {selectedFile?.type === 'file' ? (
          <>
            {/* Custom Editor */}
            <div className="flex-1 flex">
              {/* Line Numbers */}
              <div className="bg-zinc-900 border-r border-zinc-800 px-4 py-4 text-right text-zinc-500 text-xs font-mono select-none overflow-hidden">
                {content.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Code Input */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 bg-zinc-950 text-zinc-100 font-mono px-4 py-4 focus:outline-none resize-none text-sm leading-relaxed"
                spellCheck="false"
              />
            </div>

            {/* Bottom Status Bar */}
            <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center justify-between text-xs text-zinc-400">
              <div>Line 1, Column 1</div>
              <button className="flex items-center gap-1 px-2 py-1 hover:bg-blue-600 rounded transition">
                <Save size={14} /> Save
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <p className="text-lg">Select a file to edit</p>
            <p className="text-sm mt-2">Or clone a Git repository to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
