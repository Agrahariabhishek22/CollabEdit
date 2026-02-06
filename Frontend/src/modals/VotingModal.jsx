import React, { useState, useEffect } from "react";
import { X, ThumbsUp, ThumbsDown } from "lucide-react";
import { useSocket } from "../hooks/useSocket";

export default function VotingModal({
  checkpointId,
  fileId,
  projectId,
  requesterEmail,
  onClose,
}) {
  const [votes, setVotes] = useState({ yes: 0, no: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [voters, setVoters] = useState([]);
  const [totalCollaborators, setTotalCollaborators] = useState(0);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleVoteUpdate = (data) => {
      setVotes({ yes: data.yesCount, no: data.noCount });
      setVoters(data.voters || []);
      setTotalCollaborators(data.totalCollaborators || 0);

      // Check if voting is complete (>50% votes)
      const totalVotes = data.yesCount + data.noCount;
      if (totalVotes > 0 && totalVotes / data.totalCollaborators > 0.5) {
        // Auto-close if voting threshold reached
        setTimeout(() => onClose(), 1000);
      }
    };

    socket.on("voting:update", handleVoteUpdate);

    return () => {
      socket.off("voting:update", handleVoteUpdate);
    };
  }, [socket, onClose]);

  const handleVote = (choice) => {
    if (hasVoted) return;

    socket?.emit("voting:vote", {
      checkpointId,
      fileId,
      projectId,
      choice, // "yes" or "no"
    });

    setHasVoted(true);
  };

  const yesPercentage =
    votes.yes + votes.no > 0
      ? Math.round((votes.yes / (votes.yes + votes.no)) * 100)
      : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">
            Revert Checkpoint?
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-slate-300 mb-6">
            <span className="font-medium">{requesterEmail}</span> requested to
            revert to a checkpoint. Team consensus required (50%+).
          </p>

          {/* Vote Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => handleVote("yes")}
              disabled={hasVoted}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors ${
                hasVoted
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              <ThumbsUp size={16} />
              Yes
            </button>

            <button
              onClick={() => handleVote("no")}
              disabled={hasVoted}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors ${
                hasVoted
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-500 text-white"
              }`}
            >
              <ThumbsDown size={16} />
              No
            </button>
          </div>

          {/* Vote Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">
                Votes: {votes.yes + votes.no} / {totalCollaborators}
              </span>
              <span className="text-sm font-medium text-slate-200">
                {yesPercentage}% Yes
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-300"
                style={{ width: `${yesPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Voters List */}
          {voters.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase">
                Votes
              </h3>
              <div className="space-y-2">
                {voters.map((voter) => (
                  <div key={voter.userId} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                    <span className="text-sm text-slate-300 flex-1">
                      {voter.email}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        voter.choice === "yes"
                          ? "bg-green-600/30 text-green-300"
                          : "bg-red-600/30 text-red-300"
                      }`}
                    >
                      {voter.choice === "yes" ? "✓ Yes" : "✗ No"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasVoted && (
            <div className="text-sm text-slate-400 text-center">
              ✓ Your vote has been recorded
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
