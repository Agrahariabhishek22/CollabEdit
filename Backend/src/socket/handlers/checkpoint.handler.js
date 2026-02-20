// src/socket/handlers/checkpoint.handler.js

/**
 * CheckpointHandler
 *
 * Socket events for checkpoint creation and voting:
 * - checkpoint:create     (create a snapshot)
 * - checkpoint:list       (get all checkpoints)
 * - checkpoint:vote       (initiate vote to restore)
 * - checkpoint:vote-cast  (user casts vote)
 * - checkpoint:result     (check vote result)
 */
class CheckpointHandler {
  constructor(io, checkpointManager, votingManager, permissionValidator) {
    this.io = io;
    this.checkpointManager = checkpointManager;
    this.votingManager = votingManager;
    this.permissionValidator = permissionValidator;
  }

  register(socket) {
    socket.on("checkpoint:create", async (data) => {
      await this._handleCreate(socket, data);
    });

    socket.on("checkpoint:list", async (data) => {
      await this._handleList(socket, data);
    });

    socket.on("checkpoint:initiate-vote", async (data) => {
      await this._handleInitiateVote(socket, data);
    });

    socket.on("checkpoint:vote", async (data) => {
      await this._handleVote(socket, data);
    });

    socket.on("checkpoint:result", async (data) => {
      await this._handleGetResult(socket, data);
    });

    console.log(`[CheckpointHandler] Events registered for socket ${socket.id}`);
  }

  /**
   * EVENT: Create checkpoint
   */
  async _handleCreate(socket, { fileId, description }) {
    try {
      const { userId } = socket;

      // Validate EDIT access
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        "EDIT"
      );

      if (!validation.allowed) {
        return socket.emit("checkpoint:error", {
          error: "Access denied",
        });
      }

      // Create checkpoint
      const checkpoint = await this.checkpointManager.create(
        fileId,
        userId,
        description
      );

      if (!checkpoint) {
        return socket.emit("checkpoint:error", {
          error: "Failed to create checkpoint",
        });
      }

      // Notify all users in file
      this.io.to(`file:${fileId}`).emit("checkpoint:created", {
        checkpoint: {
          id: checkpoint.id,
          fileId: checkpoint.fileId,
          createdBy: checkpoint.createdBy,
          createdAt: checkpoint.createdAt,
          description: checkpoint.description,
        },
      });

      socket.emit("checkpoint:created", { checkpoint: checkpoint.id });

      console.log(
        `[CheckpointHandler] Checkpoint created for ${fileId} by ${userId}`
      );
    } catch (err) {
      console.error("[CheckpointHandler] Create error:", err);
      socket.emit("checkpoint:error", { error: err.message });
    }
  }

  /**
   * EVENT: List checkpoints
   */
  async _handleList(socket, { fileId }) {
    try {
      const checkpoints = await this.checkpointManager.listCheckpoints(fileId);

      socket.emit("checkpoint:list", { fileId, checkpoints });

      console.log(
        `[CheckpointHandler] Listed ${checkpoints.length} checkpoints for ${fileId}`
      );
    } catch (err) {
      console.error("[CheckpointHandler] List error:", err);
      socket.emit("checkpoint:error", { error: err.message });
    }
  }

  /**
   * EVENT: Initiate vote to restore checkpoint
   */
  async _handleInitiateVote(socket, { checkpointId, fileId }) {
    try {
      const { userId } = socket;

      // Get current participants in file
      const participants = await this._getFileParticipants(fileId);

      const voteResult = await this.votingManager.initiateVote(
        checkpointId,
        fileId,
        userId,
        participants
      );

      if (!voteResult.success) {
        return socket.emit("checkpoint:error", {
          error: voteResult.error,
        });
      }

      // Notify all users in file
      this.io.to(`file:${fileId}`).emit("checkpoint:vote-initiated", {
        voteId: voteResult.voteId,
        checkpointId,
        initiatedBy: userId,
        participants,
        expiresAt: voteResult.vote.expiresAt,
      });

      console.log(
        `[CheckpointHandler] Vote initiated by ${userId} for checkpoint ${checkpointId}`
      );
    } catch (err) {
      console.error("[CheckpointHandler] Initiate vote error:", err);
      socket.emit("checkpoint:error", { error: err.message });
    }
  }

  /**
   * EVENT: Cast vote
   */
  async _handleVote(socket, { voteId, choice }) {
    try {
      const { userId } = socket;

      const voteResult = await this.votingManager.vote(voteId, userId, choice);

      if (!voteResult.success) {
        return socket.emit("checkpoint:error", {
          error: voteResult.error,
        });
      }

      // Notify all users about the vote
      const { vote, result } = voteResult;

      this.io.to(`file:${vote.fileId}`).emit("checkpoint:vote-cast", {
        voteId,
        userId,
        choice,
        result,
      });

      // If vote passed, auto-restore
      if (result.passed && result.allVoted) {
        await this._restoreCheckpoint(vote.checkpointId, vote.fileId);

        this.io.to(`file:${vote.fileId}`).emit("checkpoint:restored", {
          checkpointId: vote.checkpointId,
          voteId,
        });
      }

      console.log(
        `[CheckpointHandler] ${userId} voted for checkpoint restore`
      );
    } catch (err) {
      console.error("[CheckpointHandler] Vote error:", err);
      socket.emit("checkpoint:error", { error: err.message });
    }
  }

  /**
   * EVENT: Get vote result
   */
  async _handleGetResult(socket, { voteId }) {
    try {
      const result = await this.votingManager.getResult(voteId);

      if (!result.success) {
        return socket.emit("checkpoint:error", {
          error: result.error,
        });
      }

      socket.emit("checkpoint:result", { voteId, result: result.result });

      console.log(`[CheckpointHandler] Got result for vote ${voteId}`);
    } catch (err) {
      console.error("[CheckpointHandler] Get result error:", err);
      socket.emit("checkpoint:error", { error: err.message });
    }
  }

  /**
   * Helper: Restore checkpoint
   */
  async _restoreCheckpoint(checkpointId, fileId) {
    try {
      const result = await this.checkpointManager.restore(checkpointId, fileId);

      if (result.success) {
        console.log(`[CheckpointHandler] Restored ${fileId} to ${checkpointId}`);
      }

      return result;
    } catch (err) {
      console.error("[CheckpointHandler] Restore error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Helper: Get participants in file
   */
  async _getFileParticipants(fileId) {
    // TODO: Get from SessionManager
    // For now, return empty (will be connected to SessionManager)
    return [];
  }
}

export default CheckpointHandler;