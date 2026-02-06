// services/lsp/LSPManager.js

import { spawn } from 'child_process';
import path from 'path';

class LSPManager {
  constructor(redis) {
    this.redis = redis;
    
    // Active LSP processes
    // Key: fileId, Value: { process, language, lastActivity, pid }
    this.processes = new Map();
    
    // Language server configs
    this.lspConfigs = {
      javascript: {
        command: 'typescript-language-server',
        args: ['--stdio'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      python: {
        command: 'pyright-langserver',
        args: ['--stdio'],
        extensions: ['.py'],
      },
      java: {
        command: 'jdtls',
        args: [],
        extensions: ['.java'],
      },
      cpp: {
        command: 'clangd',
        args: ['--background-index'],
        extensions: ['.cpp', '.cc', '.h', '.hpp'],
      },
      go: {
        command: 'gopls',
        args: ['serve'],
        extensions: ['.go'],
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // SPAWN LSP PROCESS
  // ═══════════════════════════════════════════════════════════

  async spawn(fileId, filePath, projectRoot) {
    // Check if already running
    if (this.processes.has(fileId)) {
      const proc = this.processes.get(fileId);
      proc.lastActivity = Date.now();
      return proc;
    }

    // Detect language from file extension
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);

    if (!language) {
      throw new Error(`Unsupported file extension: ${ext}`);
    }

    const config = this.lspConfigs[language];

    // Spawn process
    const lspProcess = spawn(config.command, config.args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const processData = {
      process: lspProcess,
      language,
      fileId,
      filePath,
      projectRoot,
      pid: lspProcess.pid,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      initialized: false,
    };

    this.processes.set(fileId, processData);

    // Initialize LSP
    await this.initialize(processData);

    // Listen to stdout (LSP responses)
    lspProcess.stdout.on('data', (data) => {
      this.handleLSPResponse(fileId, data);
    });

    lspProcess.stderr.on('data', (data) => {
      console.error(`[LSP ${language}] Error:`, data.toString());
    });

    lspProcess.on('exit', (code) => {
      console.log(`[LSP ${language}] Process exited: ${code}`);
      this.processes.delete(fileId);
    });

    return processData;
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZE LSP (Send initialize request)
  // ═══════════════════════════════════════════════════════════

  async initialize(processData) {
    const { process, projectRoot } = processData;

    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootUri: `file://${projectRoot}`,
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: true,
              didSave: true,
            },
            completion: {
              dynamicRegistration: true,
            },
            publishDiagnostics: {
              relatedInformation: true,
            },
          },
        },
      },
    };

    this.sendRequest(processData, initRequest);

    // Wait for initialize response
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Send initialized notification
    this.sendNotification(processData, {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    });

    processData.initialized = true;
  }

  // ═══════════════════════════════════════════════════════════
  // SEND DID_OPEN (When file opens)
  // ═══════════════════════════════════════════════════════════

  async didOpen(fileId, filePath, languageId, content) {
    const proc = this.processes.get(fileId);
    if (!proc || !proc.initialized) return;

    this.sendNotification(proc, {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri: `file://${filePath}`,
          languageId,
          version: 1,
          text: content,
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SEND DID_CHANGE (Incremental updates)
  // ═══════════════════════════════════════════════════════════

  async didChange(fileId, filePath, contentChanges, version) {
    const proc = this.processes.get(fileId);
    if (!proc || !proc.initialized) return;

    proc.lastActivity = Date.now();

    this.sendNotification(proc, {
      jsonrpc: '2.0',
      method: 'textDocument/didChange',
      params: {
        textDocument: {
          uri: `file://${filePath}`,
          version,
        },
        contentChanges: [
          {
            text: contentChanges, // Full text for now (can optimize to deltas)
          },
        ],
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE LSP RESPONSES (Diagnostics, etc.)
  // ═══════════════════════════════════════════════════════════

  handleLSPResponse(fileId, data) {
    try {
      const messages = data.toString().split('\r\n\r\n');
      
      for (const msg of messages) {
        if (!msg.trim()) continue;

        // Parse JSON-RPC message
        const [header, body] = msg.split('\r\n');
        if (!body) continue;

        const response = JSON.parse(body);

        // Handle diagnostics
        if (response.method === 'textDocument/publishDiagnostics') {
          this.handleDiagnostics(fileId, response.params);
        }

        // Store response in Redis for frontend retrieval
        this.redis.lpush(
          `lsp:responses:${fileId}`,
          JSON.stringify(response)
        );
        this.redis.expire(`lsp:responses:${fileId}`, 60); // 1 min TTL
      }
    } catch (err) {
      console.error('[LSP] Parse error:', err);
    }
  }

  handleDiagnostics(fileId, params) {
    // Store diagnostics
    this.redis.set(
      `lsp:diagnostics:${fileId}`,
      JSON.stringify(params.diagnostics)
    );

    // Emit to frontend via Socket.io (handled in socket handler)
    global.io?.to(`file:${fileId}`).emit('lsp:diagnostics', {
      fileId,
      diagnostics: params.diagnostics,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SEND REQUEST/NOTIFICATION
  // ═══════════════════════════════════════════════════════════

  sendRequest(processData, request) {
    const message = JSON.stringify(request);
    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    processData.process.stdin.write(header + message);
  }

  sendNotification(processData, notification) {
    this.sendRequest(processData, notification);
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP (Kill idle LSP processes)
  // ═══════════════════════════════════════════════════════════

  async cleanupIdle(idleThresholdMs = 5 * 60 * 1000) {
    const now = Date.now();

    for (const [fileId, proc] of this.processes.entries()) {
      if (now - proc.lastActivity > idleThresholdMs) {
        console.log(`[LSP] Killing idle process for ${fileId}`);
        proc.process.kill();
        this.processes.delete(fileId);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  detectLanguage(ext) {
    for (const [lang, config] of Object.entries(this.lspConfigs)) {
      if (config.extensions.includes(ext.toLowerCase())) {
        return lang;
      }
    }
    return null;
  }
}

export default LSPManager;