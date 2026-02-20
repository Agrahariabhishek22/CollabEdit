// src/services/checkpoint/VotingManager.js

/**
 * VotingManager
 *
 * Handles democratic voting for checkpoint restoration.
 * Users vote on whether to revert to a previous checkpoint.
 *
 * VOTING STRUCTURE:
 * {
 *   id: uuid,
 *   checkpointId: string,
 *   fileId: string,
 *   initiatedBy: userId,
 *   votes: { userId: true/false },
 *   status: "active" | "passed" | "failed" | "expired",
 *   createdAt: timestamp,
 *   expiresAt: timestamp (5 min)
 * }
 *
 * VOTING RULES:
 * - Majority wins (> 50%)
 * - Minimum 2 participants needed
 * - Vote expires after 5 minutes
 *
 * USAGE:
 * manager.initiateVote(checkpointId, fileId, initiatedBy, participants)
 * manager.vote(voteId, userId, choice)
 * manager.getResult(voteId)
 */
class VotingManager {
  constructor(redis) {
    this.redis = redis;
    this.activeVotes = new Map(); // voteId → voteData
  }

  /**
   * Initiate a vote for checkpoint restoration
   */
  async initiateVote(checkpointId, fileId, initiatedBy, participants) {
    try {
      const voteId = `vote-${Date.now()}`;

      // Need at least 2 participants (including initiator)
      if (participants.length < 2) {
        return {
          success: false,
          error: "Need at least 2 participants to vote",
        };
      }

      const vote = {
        id: voteId,
        checkpointId,
        fileId,
        initiatedBy,
        votes: { [initiatedBy]: true }, // Initiator votes yes by default
        participants,
        status: "active",
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
      };

      // Store in Redis
      await this.redis.set(
        `vote:${voteId}`,
        JSON.stringify(vote),
        { EX: 300 } // 5 min TTL
      );

      // Track in memory
      this.activeVotes.set(voteId, vote);

      console.log(
        `[VotingManager] Vote initiated ${voteId} for checkpoint ${checkpointId}`
      );

      return { success: true, voteId, vote };
    } catch (err) {
      console.error("[VotingManager] Initiate vote error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Cast a vote
   */
  async vote(voteId, userId, choice) {
    try {
      const voteData = await this.redis.get(`vote:${voteId}`);
      if (!voteData) {
        return { success: false, error: "Vote not found or expired" };
      }

      const vote = JSON.parse(voteData);

      // Check if user is participant
      if (!vote.participants.includes(userId) && userId !== vote.initiatedBy) {
        return {
          success: false,
          error: "You are not a participant in this vote",
        };
      }

      // Check if already voted
      if (vote.votes[userId] !== undefined) {
        return { success: false, error: "You have already voted" };
      }

      // Check if expired
      if (Date.now() > vote.expiresAt) {
        vote.status = "expired";
        return { success: false, error: "Vote has expired" };
      }

      // Record vote
      vote.votes[userId] = choice;

      // Update Redis
      await this.redis.set(`vote:${voteId}`, JSON.stringify(vote), {
        EX: 300,
      });

      this.activeVotes.set(voteId, vote);

      console.log(
        `[VotingManager] ${userId} voted ${choice ? "YES" : "NO"} for ${voteId}`
      );

      // Check if voting is complete
      const result = this._getResult(vote);

      return { success: true, vote, result };
    } catch (err) {
      console.error("[VotingManager] Vote error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get voting result
   */
  async getResult(voteId) {
    try {
      const voteData = await this.redis.get(`vote:${voteId}`);
      if (!voteData) {
        return { success: false, error: "Vote not found" };
      }

      const vote = JSON.parse(voteData);
      const result = this._getResult(vote);

      return { success: true, vote, result };
    } catch (err) {
      console.error("[VotingManager] Get result error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Calculate voting result
   */
  _getResult(vote) {
    const totalParticipants = vote.participants.length + 1; // +1 for initiator
    const votesReceived = Object.keys(vote.votes).length;
    const yesVotes = Object.values(vote.votes).filter((v) => v === true).length;

    const passed = yesVotes > totalParticipants / 2;
    const allVoted = votesReceived === totalParticipants;

    return {
      totalParticipants,
      votesReceived,
      yesVotes,
      noVotes: votesReceived - yesVotes,
      passed,
      allVoted,
      status: allVoted ? (passed ? "passed" : "failed") : "pending",
    };
  }

  /**
   * Cancel a vote
   */
  async cancel(voteId, userId) {
    try {
      const voteData = await this.redis.get(`vote:${voteId}`);
      if (!voteData) {
        return { success: false, error: "Vote not found" };
      }

      const vote = JSON.parse(voteData);

      // Only initiator can cancel
      if (vote.initiatedBy !== userId) {
        return {
          success: false,
          error: "Only initiator can cancel vote",
        };
      }

      vote.status = "cancelled";
      await this.redis.set(`vote:${voteId}`, JSON.stringify(vote), {
        EX: 300,
      });

      this.activeVotes.delete(voteId);

      console.log(`[VotingManager] Vote ${voteId} cancelled by ${userId}`);

      return { success: true };
    } catch (err) {
      console.error("[VotingManager] Cancel error:", err);
      return { success: false, error: err.message };
    }
  }
}

export default VotingManager;