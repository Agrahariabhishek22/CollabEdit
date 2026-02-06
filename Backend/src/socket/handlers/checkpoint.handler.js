// socket/handlers/checkpoint.handler.js

class CheckpointHandler {
  constructor(io, checkpointManager, votingManager, permissionValidator) {
    this.io = io;
    this.checkpointManager = checkpointManager;
    this.votingManager = votingManager;
    this.permissionValidator = permissionValidator;
  }

  register(socket) {
    // ═══════════════════════════════════════════════════════════
    // CREATE CHECKPOINT
    // ═══════════════════════════════════════════════════════════

    socket.on('checkpoint:create', async ({ fileId }) => {
      await this.handleCreateCheckpoint(socket, fileId);
    });

    // ═══════════════════════════════════════════════════════════
    // REQUEST REVERT
    // ═══════════════════════════════════════════════════════════

    socket.on('checkpoint:request-revert', async ({ fileId, checkpointId }) => {
      await this.handleRequestRevert(socket, fileId, checkpointId);
    });

    // ═══════════════════════════════════════════════════════════
    // CAST VOTE
    // ═══════════════════════════════════════════════════════════

    socket.on('checkpoint:vote', async ({ voteId, vote }) => {
      await this.handleVote(socket, voteId, vote);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE CHECKPOINT
  // ═══════════════════════════════════════════════════════════

  async handleCreateCheckpoint(socket, fileId) {
    const { userId, userName } = socket;

    try {
      // Validate permission
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        'CHECKPOINT'
      );

      if (!validation.allowed) {
        return socket.emit('checkpoint:error', {
          message: 'You do not have permission to create checkpoints',
        });
      }

      // Create checkpoint
      const checkpoint = await this.checkpointManager.create(fileId, userId);

      // Notify user
      socket.emit('checkpoint:created', {
        fileId,
        checkpoint,
      });

      // Broadcast to others
      socket.to(`file:${fileId}`).emit('checkpoint:user-created', {
        fileId,
        userId,
        userName,
        timestamp: checkpoint.timestamp,
      });

      console.log(`[Checkpoint] ${userName} created checkpoint for ${fileId}`);

    } catch (err) {
      console.error('[Checkpoint] Create error:', err);
      socket.emit('checkpoint:error', {
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // REQUEST REVERT (Start voting)
  // ═══════════════════════════════════════════════════════════

  async handleRequestRevert(socket, fileId, checkpointId) {
    const { userId, userName } = socket;

    try {
      // Get all active participants
      const participants = await this.sessionManager.getFileParticipants(fileId);
      const participantIds = Object.keys(participants);

      if (participantIds.length === 1) {
        // Only requester is online, auto-approve
        await this.executeRevert(fileId, checkpointId);
        
        socket.emit('checkpoint:reverted', {
          fileId,
          checkpointId,
        });

        return;
      }

      // Start voting
      const voteSession = await this.votingManager.startVote({
        fileId,
        checkpointId,
        requestedBy: userId,
        participants: participantIds,
        timeout: 30000, // 30 seconds
      });

      // Broadcast vote request to all
      this.io.to(`file:${fileId}`).emit('checkpoint:vote-started', {
        voteId: voteSession.id,
        fileId,
        checkpointId,
        requestedBy: userName,
        totalVoters: participantIds.length,
        timeout: 30000,
      });

      console.log(`[Checkpoint] Vote started for ${fileId} by ${userName}`);

    } catch (err) {
      console.error('[Checkpoint] Revert request error:', err);
      socket.emit('checkpoint:error', {
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE VOTE
  // ═══════════════════════════════════════════════════════════

  async handleVote(socket, voteId, vote) {
    const { userId, userName } = socket;

    try {
      // Register vote
      const result = await this.votingManager.castVote(voteId, userId, vote);

      // Broadcast vote update
      this.io.to(`file:${result.fileId}`).emit('checkpoint:vote-cast', {
        voteId,
        userId,
        userName,
        vote,
        yesCount: result.yesCount,
        noCount: result.noCount,
        totalVoters: result.totalVoters,
      });

      // Check if voting complete
      if (result.status === 'PASSED') {
        // Execute revert
        await this.executeRevert(result.fileId, result.checkpointId);

        this.io.to(`file:${result.fileId}`).emit('checkpoint:reverted', {
          fileId: result.fileId,
          checkpointId: result.checkpointId,
          result: 'PASSED',
        });

      } else if (result.status === 'REJECTED') {
        this.io.to(`file:${result.fileId}`).emit('checkpoint:vote-rejected', {
          voteId,
          fileId: result.fileId,
        });
      }

    } catch (err) {
      console.error('[Checkpoint] Vote error:', err);
      socket.emit('checkpoint:error', {
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EXECUTE REVERT (Apply checkpoint)
  // ═══════════════════════════════════════════════════════════

  async executeRevert(fileId, checkpointId) {
    try {
      // Load checkpoint
      const checkpoint = await this.checkpointManager.load(checkpointId);

      // Apply to Shadow Y.Doc
      await this.yjsDocManager.applyCheckpoint(fileId, checkpoint.yjsState);

      // Broadcast full state to all users
      const stateVector = await this.yjsDocManager.getStateVector(fileId);

      this.io.to(`file:${fileId}`).emit('yjs:full-sync', {
        fileId,
        state: Array.from(stateVector),
      });

      console.log(`[Checkpoint] Reverted ${fileId} to checkpoint ${checkpointId}`);

    } catch (err) {
      console.error('[Checkpoint] Execute revert error:', err);
      throw err;
    }
  }
}

export default CheckpointHandler;