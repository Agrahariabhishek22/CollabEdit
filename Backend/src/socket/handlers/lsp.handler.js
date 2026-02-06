// socket/handlers/lsp.handler.js

class LSPHandler {
  constructor(io, lspManager, yjsDocManager, permissionValidator) {
    this.io = io;
    this.lspManager = lspManager;
    this.yjsDocManager = yjsDocManager;
    this.permissionValidator = permissionValidator;
    
    // Debounce timers
    this.analysisTimers = new Map();
  }

  register(socket) {
    // ═══════════════════════════════════════════════════════════
    // REQUEST ANALYSIS (Manual trigger)
    // ═══════════════════════════════════════════════════════════

    socket.on('lsp:analyze', async ({ fileId }) => {
      await this.handleAnalyze(socket, fileId);
    });

    // ═══════════════════════════════════════════════════════════
    // REQUEST COMPLETION (Autocomplete)
    // ═══════════════════════════════════════════════════════════

    socket.on('lsp:completion', async ({ fileId, position }) => {
      await this.handleCompletion(socket, fileId, position);
    });

    // ═══════════════════════════════════════════════════════════
    // REQUEST HOVER (Type info)
    // ═══════════════════════════════════════════════════════════

    socket.on('lsp:hover', async ({ fileId, position }) => {
      await this.handleHover(socket, fileId, position);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DEBOUNCED ANALYSIS (Auto-triggered after typing stops)
  // ═══════════════════════════════════════════════════════════

  scheduleAnalysis(fileId, filePath, projectRoot) {
    // Clear existing timer
    if (this.analysisTimers.has(fileId)) {
      clearTimeout(this.analysisTimers.get(fileId));
    }

    // Set new timer (800ms debounce)
    const timer = setTimeout(async () => {
      try {
        await this.runAnalysis(fileId, filePath, projectRoot);
      } catch (err) {
        console.error('[LSP] Analysis error:', err);
      }
      this.analysisTimers.delete(fileId);
    }, 800);

    this.analysisTimers.set(fileId, timer);
  }

  // ═══════════════════════════════════════════════════════════
  // RUN ANALYSIS
  // ═══════════════════════════════════════════════════════════

  async runAnalysis(fileId, filePath, projectRoot) {
    try {
      // Get Shadow Y.Doc content
      const docData = await this.yjsDocManager.getOrCreateDoc(fileId);
      const content = docData.ytext.toString();

      // Spawn or get LSP process
      const lspProc = await this.lspManager.spawn(fileId, filePath, projectRoot);

      // Send didChange to LSP
      await this.lspManager.didChange(
        fileId,
        filePath,
        content,
        Date.now() // version
      );

      console.log(`[LSP] Analysis triggered for ${fileId}`);

      // Diagnostics will be emitted via LSP response handler

    } catch (err) {
      console.error('[LSP] Run analysis error:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE ANALYZE (Manual request)
  // ═══════════════════════════════════════════════════════════

  async handleAnalyze(socket, fileId) {
    const { userId } = socket;

    try {
      // Validate access
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        'READ'
      );

      if (!validation.allowed) {
        return socket.emit('lsp:error', {
          fileId,
          message: 'Access denied',
        });
      }

      // Get file metadata from DB
      const file = await prisma.fileMeta.findUnique({
        where: { id: fileId },
        include: { project: true },
      });

      if (!file) {
        return socket.emit('lsp:error', {
          fileId,
          message: 'File not found',
        });
      }

      // Trigger analysis
      await this.runAnalysis(fileId, file.absolutePath, file.project.rootPath);

      socket.emit('lsp:analyzing', { fileId });

    } catch (err) {
      console.error('[LSP] Analyze error:', err);
      socket.emit('lsp:error', {
        fileId,
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE COMPLETION (Autocomplete)
  // ═══════════════════════════════════════════════════════════

  async handleCompletion(socket, fileId, position) {
    try {
      // TODO: Send completion request to LSP
      // For now, return empty (Tree-sitter handles frontend)
      
      socket.emit('lsp:completion-result', {
        fileId,
        items: [],
      });

    } catch (err) {
      console.error('[LSP] Completion error:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE HOVER
  // ═══════════════════════════════════════════════════════════

  async handleHover(socket, fileId, position) {
    try {
      // TODO: Send hover request to LSP
      
      socket.emit('lsp:hover-result', {
        fileId,
        content: null,
      });

    } catch (err) {
      console.error('[LSP] Hover error:', err);
    }
  }
}

export default LSPHandler;