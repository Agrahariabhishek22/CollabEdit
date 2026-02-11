import React, { useState, useEffect, useCallback } from "react";
import { X, Loader, ChevronDown, Copy, Check } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import DiffViewer from "./DiffViewer";

export default function HistoryModal({ isOpen, onClose, projectId }) {
  // Commits list state
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [selectedCommitDiff, setSelectedCommitDiff] = useState(null);

  // Loading states
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  // Pagination
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Copy to clipboard
  const [copiedHash, setCopiedHash] = useState(null);

  // ============= FETCH COMMITS =============
  const fetchCommits = useCallback(async (limitVal = 50, offsetVal = 0) => {
    if (!projectId) return;

    setIsLoadingCommits(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/git/${projectId}/commits?limit=${limitVal}&offset=${offsetVal}`,
        { withCredentials: true }
      );

      if (res.data.success) {
        if (offsetVal === 0) {
          // First load
          setCommits(res.data.commits || []);
        } else {
          // Load more
          setCommits((prev) => [...prev, ...(res.data.commits || [])]);
        }
        setHasMore(res.data.hasMore || false);
        setTotal(res.data.total || 0);
        setLimit(res.data.limit);

        // Auto-select first commit
        if (!selectedCommit && res.data.commits?.length > 0) {
          setSelectedCommit(res.data.commits[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch commits:", err);
      toast.error("Failed to load commit history");
    } finally {
      setIsLoadingCommits(false);
    }
  }, [projectId, selectedCommit]);

  // ============= FETCH COMMIT DIFF =============
  const fetchCommitDiff = useCallback(
    async (commitHash) => {
      if (!projectId || !commitHash) return;

      setIsLoadingDiff(true);
      try {
        const res = await axios.get(
          `http://localhost:3000/api/git/${projectId}/commits/${commitHash}/diff`,
          { withCredentials: true }
        );

        if (res.data.success) {
          setSelectedCommitDiff(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch commit diff:", err);
        toast.error("Failed to load commit diff");
      } finally {
        setIsLoadingDiff(false);
      }
    },
    [projectId]
  );

  // ============= INITIAL LOAD =============
  useEffect(() => {
    if (isOpen && projectId) {
      fetchCommits(50, 0);
    }
  }, [isOpen, projectId]);

  // ============= HANDLE COMMIT SELECT =============
  const handleCommitClick = (commit) => {
    setSelectedCommit(commit);
    setSelectedCommitDiff(null); // Reset diff
    fetchCommitDiff(commit.fullHash || commit.hash);
  };

  // ============= HANDLE LOAD MORE =============
  const handleLoadMore = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchCommits(limit, newOffset);
  };

  // ============= COPY TO CLIPBOARD =============
  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
    toast.success("Commit hash copied!");
  };

  // ============= FORMAT DATE =============
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-lg w-11/12 h-5/6 shadow-2xl border border-slate-700 flex flex-col overflow-hidden">
        
        {/* ============= HEADER ============= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Commit History</h2>
            <p className="text-xs text-slate-400 mt-1">
              Total commits: <span className="font-mono">{total}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition p-1 hover:bg-slate-700 rounded"
          >
            <X size={24} />
          </button>
        </div>

        {/* ============= MAIN CONTENT (SPLIT VIEW) ============= */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* ============= LEFT: COMMITS LIST ============= */}
          <div className="w-96 border-r border-slate-700 flex flex-col bg-slate-850">
            {/* Commits list header */}
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/30">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Recent Commits
              </p>
            </div>

            {/* Commits list scrollable */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingCommits && commits.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="animate-spin text-blue-500" size={32} />
                </div>
              ) : commits.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400 text-center">No commits yet</p>
                </div>
              ) : (
                commits.map((commit) => (
                  <div
                    key={commit.fullHash || commit.hash}
                    onClick={() => handleCommitClick(commit)}
                    className={`px-4 py-3 border-b border-slate-700 cursor-pointer transition group ${
                      selectedCommit?.fullHash === commit.fullHash ||
                      selectedCommit?.hash === commit.hash
                        ? "bg-blue-900/30 border-l-2 border-l-blue-500"
                        : "hover:bg-slate-700/30"
                    }`}
                  >
                    {/* Commit message */}
                    <p className="text-sm font-medium text-slate-100 truncate mb-1">
                      {commit.message}
                    </p>

                    {/* Author and date */}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-400">
                        {commit.author || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(commit.date)}
                      </p>
                    </div>

                    {/* Commit hash */}
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                        {commit.hash}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyHash(commit.fullHash || commit.hash);
                        }}
                        className="text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition p-1"
                        title="Copy full hash"
                      >
                        {copiedHash === (commit.fullHash || commit.hash) ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Load more button */}
              {hasMore && (
                <div className="px-4 py-3 border-b border-slate-700">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingCommits}
                    className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition disabled:opacity-50"
                  >
                    {isLoadingCommits ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ============= RIGHT: DIFF PREVIEW ============= */}
          <div className="flex-1 flex flex-col bg-slate-900">
            {selectedCommit ? (
              <>
                {/* Commit details header */}
                <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
                  <div className="space-y-3">
                    {/* Message */}
                    <div>
                      <p className="text-lg font-semibold text-slate-100">
                        {selectedCommit.message}
                      </p>
                      {selectedCommit.description && (
                        <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">
                          {selectedCommit.description}
                        </p>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500 uppercase tracking-wider">Author</p>
                        <p className="text-slate-100 font-medium">
                          {selectedCommit.author || "Unknown"}
                        </p>
                        <p className="text-slate-400">{selectedCommit.email}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wider">Date</p>
                        <p className="text-slate-100 font-medium">
                          {new Date(selectedCommit.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 uppercase tracking-wider">Hash</p>
                        <code className="text-slate-100 font-mono bg-slate-700/50 px-2 py-1 rounded">
                          {selectedCommit.hash}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diff content */}
                <div className="flex-1 overflow-y-auto">
                  {isLoadingDiff ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader className="animate-spin text-blue-500" size={32} />
                    </div>
                  ) : selectedCommitDiff ? (
                    <div className="p-6 space-y-6">
                      {/* File stats */}
                      <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                        <p className="text-sm font-medium text-slate-100 mb-2">
                          📊 Changes Summary
                        </p>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-slate-400">Files changed: </span>
                            <span className="font-mono font-semibold text-slate-100">
                              {selectedCommitDiff.stats?.totalFiles || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Additions: </span>
                            <span className="font-mono font-semibold text-green-400">
                              +{selectedCommitDiff.stats?.totalAdditions || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Deletions: </span>
                            <span className="font-mono font-semibold text-red-400">
                              -{selectedCommitDiff.stats?.totalDeletions || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Files changed list */}
                      {selectedCommitDiff.filesChanged &&
                        selectedCommitDiff.filesChanged.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-slate-100 mb-3">
                              📁 Files Changed ({selectedCommitDiff.filesChanged.length})
                            </p>
                            <div className="space-y-2">
                              {selectedCommitDiff.filesChanged.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-800/30 p-3 rounded border border-slate-700 flex items-center justify-between"
                                >
                                  <div className="flex-1 truncate">
                                    <p className="text-sm text-slate-200 font-mono">
                                      {file.path}
                                    </p>
                                  </div>
                                  <div className="flex gap-3 text-xs font-mono ml-4">
                                    <span className="text-green-400">
                                      +{file.additions}
                                    </span>
                                    <span className="text-red-400">
                                      -{file.deletions}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Raw diff using DiffViewer */}
                      {selectedCommitDiff.diff && (
                        <div>
                          <p className="text-sm font-medium text-slate-100 mb-3">
                            📝 Diff Preview
                          </p>
                          <DiffViewer diff={selectedCommitDiff.diff} maxLines={100} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-400">Select a commit to view diff</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-400">Select a commit to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}