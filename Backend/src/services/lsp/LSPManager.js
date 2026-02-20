// src/services/lsp/LSPManager.js
// FIXED - Response handling works properly now

import { spawn } from "child_process";
import path from "path";

class LSPManager {
  constructor(redis) {
    this.redis = redis;
    this.processes = new Map();
    this.pendingRequests = new Map(); // 🔴 CRITICAL: Track pending requests
    this.requestIdCounter = 0;
    this.responseBuffers = new Map(); // Buffer for incomplete messages
    this.diagnosticsCache = new Map();

    this.lspConfigs = {
      javascript: {
        command: "typescript-language-server",
        args: ["--stdio"],
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      python: {
        command: "pylsp",
        args: [],
        extensions: [".py"],
      },
      java: {
        command: "jdtls",
        args: ["-configuration", "/root/.config/jdtls", "-data", "/tmp/jdtls-ws"],
        extensions: [".java"],
      },
      cpp: {
        command: "clangd",
        args: ["--background-index"],
        extensions: [".cpp", ".cc", ".h", ".hpp"],
      },
      go: {
        command: "gopls",
        args: ["serve"],
        extensions: [".go"],
      },
    };
  }

  async spawn(fileId, filePath, projectRoot) {
    try {
      if (this.processes.has(fileId)) {
        const proc = this.processes.get(fileId);
        proc.lastActivity = Date.now();
        return proc;
      }

      const ext = path.extname(filePath);
      const language = this.detectLanguage(ext);

      if (!language) {
        throw new Error(`Unsupported file extension: ${ext}`);
      }

      const config = this.lspConfigs[language];

      console.log(`[LSP] Spawning ${language} server for ${fileId}`);

      // IMPORTANT: Setup listeners BEFORE any operations
      const lspProcess = spawn(config.command, config.args, {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (!lspProcess || !lspProcess.pid) {
        throw new Error(`Failed to spawn LSP process for ${language}`);
      }

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

      // 🔴 FIX: Setup listeners FIRST, THEN initialize
      this._setupProcessListeners(fileId, lspProcess, language);

      await this.initialize(processData);

      console.log(`[LSP] ${language} server initialized (PID: ${lspProcess.pid})`);

      return processData;
    } catch (err) {
      console.error(`[LSP] Spawn error for ${fileId}:`, err.message);
      throw err;
    }
  }

  /**
   * Setup event listeners BEFORE initialization
   */
  _setupProcessListeners(fileId, lspProcess, language) {
    // STDOUT: All LSP responses come here
    lspProcess.stdout.on("data", (data) => {
      this._handleLSPResponse(fileId, data);
    });

    // STDERR: Error logs
    lspProcess.stderr.on("data", (data) => {
      console.warn(`[LSP ${language}] stderr:`, data.toString().trim());
    });

    // EXIT: Process ended
    lspProcess.on("exit", (code, signal) => {
      console.log(`[LSP ${language}] Process exited: code=${code}, signal=${signal}`);
      this.processes.delete(fileId);
      this.responseBuffers.delete(fileId);
    });

    // ERROR: Process error
    lspProcess.on("error", (err) => {
      console.error(`[LSP ${language}] Process error:`, err.message);
      this.processes.delete(fileId);
    });

    console.log(`[LSP] Listeners setup for ${fileId}`);
  }

  /**
   * Initialize LSP with proper Promise handling
   */
  async initialize(processData) {
    try {
      const { projectRoot, pid, fileId } = processData;
      const reqId = ++this.requestIdCounter;

      console.log(`[LSP] Initializing (Request ID: ${reqId})...`);

      const responsePromise = new Promise((resolve, reject) => {
        // Store resolver in map
        this.pendingRequests.set(reqId, { resolve, reject });

        // Timeout after 10 seconds
        const timeoutId = setTimeout(() => {
          if (this.pendingRequests.has(reqId)) {
            this.pendingRequests.delete(reqId);
            reject(new Error(`Initialize timeout (ID: ${reqId})`));
          }
        }, 10000);

        // Store timeout ID for cleanup
        const originalResolve = resolve;
        const wrappedResolve = (data) => {
          clearTimeout(timeoutId);
          originalResolve(data);
        };

        this.pendingRequests.set(reqId, { resolve: wrappedResolve, reject });
      });

      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: reqId,
        method: "initialize",
        params: {
          processId: pid,
          rootUri: `file://${projectRoot}`,
          rootPath: projectRoot,
          capabilities: {
            textDocument: {
              synchronization: { didSave: true },
              diagnostic: { dynamicRegistration: true },
            },
          },
        },
      };

      this.sendRequest(processData, initRequest);

      // Wait for response
      const response = await responsePromise;

      console.log(`[LSP] ✅ Initialize response received (ID: ${reqId})`);

      // Send initialized notification
      this.sendNotification(processData, {
        jsonrpc: "2.0",
        method: "initialized",
        params: {},
      });

      processData.initialized = true;
    } catch (err) {
      console.error(`[LSP] Initialize error:`, err.message);
      throw err;
    }
  }

  /**
   * Handle LSP responses - THIS IS THE KEY FIX
   */
  _handleLSPResponse(fileId, data) {
    try {
      let buffer = (this.responseBuffers.get(fileId) || "") + data.toString();

      while (true) {
        // Find Content-Length header
        const headerMatch = buffer.match(/Content-Length: (\d+)/);
        if (!headerMatch) break;

        const contentLength = parseInt(headerMatch[1], 10);
        const headerEndIndex = buffer.indexOf("\r\n\r\n");

        if (headerEndIndex === -1) break;

        const bodyStartIndex = headerEndIndex + 4;

        // Check if we have the complete body
        if (buffer.length < bodyStartIndex + contentLength) break;

        // Extract body
        const body = buffer.slice(bodyStartIndex, bodyStartIndex + contentLength);

        // Remove processed message from buffer
        buffer = buffer.slice(bodyStartIndex + contentLength);

        try {
          const response = JSON.parse(body);
          this._processLSPMessage(response); // 🔴 FIX: Process each message properly
        } catch (parseErr) {
          console.error("[LSP] JSON parse error:", parseErr.message);
        }
      }

      this.responseBuffers.set(fileId, buffer);
    } catch (err) {
      console.error("[LSP] Response handling error:", err.message);
    }
  }

  /**
   * Process LSP message - THIS IS WHERE THE FIX IS
   */
  _processLSPMessage(response) {
    // 🔴 CRITICAL: Check if this is a RESPONSE to our request (has ID, no method)
    if (response.id !== undefined && !response.method) {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        console.log(`[LSP] ✅ Response ID ${response.id} resolved (Error: ${response.error ? response.error.message : "none"})`);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response);
        }
        this.pendingRequests.delete(response.id);
        return; // DONE
      }
    }

    // Handle diagnostics (notification - has method, no ID)
    if (response.method === "textDocument/publishDiagnostics") {
      console.log(`[LSP] 📊 Diagnostics received`);
      // Will be handled separately via fileId
      return;
    }

    // Ignore other notifications
    if (response.method) {
      console.log(`[LSP] 📨 Notification: ${response.method}`);
      return;
    }

    console.log(`[LSP] ❓ Unknown message:`, JSON.stringify(response).substring(0, 50));
  }

  async didChange(fileId, filePath, content, version) {
    try {
      const proc = this.processes.get(fileId);
      if (!proc || !proc.initialized) return;

      proc.lastActivity = Date.now();

      this.sendNotification(proc, {
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: {
            uri: this._pathToUri(filePath),
            version: version || Date.now(),
          },
          contentChanges: [{ text: content }],
        },
      });
    } catch (err) {
      console.error("[LSP] didChange error:", err.message);
    }
  }

  /**
   * Send request with proper JSON-RPC format
   */
  sendRequest(processData, payload) {
    try {
      const { process: lspProcess } = processData;
      if (!lspProcess || !lspProcess.stdin.writable) {
        throw new Error("LSP process stdin not writable");
      }

      const message = JSON.stringify(payload);
      const contentLength = Buffer.byteLength(message, "utf8");

      const header = `Content-Length: ${contentLength}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n`;

      lspProcess.stdin.write(header, "utf8");
      lspProcess.stdin.write(message, "utf8");

      console.log(`[LSP] 📤 Sent: ${payload.method || "Response"} (ID: ${payload.id || "N/A"})`);
    } catch (err) {
      console.error("[LSP] Send request error:", err.message);
    }
  }

  sendNotification(processData, notification) {
    this.sendRequest(processData, notification);
  }

  _pathToUri(filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    if (process.platform === "win32" && normalized[1] === ":") {
      return `file:///${normalized}`;
    }
    return `file://${normalized}`;
  }

  detectLanguage(ext) {
    if (!ext) return null;
    for (const [lang, config] of Object.entries(this.lspConfigs)) {
      if (config.extensions.includes(ext.toLowerCase())) {
        return lang;
      }
    }
    return null;
  }

  async getDiagnostics(fileId) {
    try {
      const cached = this.diagnosticsCache.get(fileId);
      if (cached && Date.now() - cached.timestamp < 10000) {
        return cached.diagnostics;
      }

      const diagnosticsJson = await this.redis.get(`lsp:diagnostics:${fileId}`);
      if (diagnosticsJson) {
        const diagnostics = JSON.parse(diagnosticsJson);
        this.diagnosticsCache.set(fileId, { diagnostics, timestamp: Date.now() });
        return diagnostics;
      }

      return [];
    } catch (err) {
      console.error("[LSP] Get diagnostics error:", err.message);
      return [];
    }
  }

  async cleanupIdle(idleThresholdMs = 5 * 60 * 1000) {
    try {
      const now = Date.now();
      for (const [fileId, proc] of this.processes.entries()) {
        if (now - proc.lastActivity > idleThresholdMs) {
          console.log(`[LSP] Killing idle process for ${fileId}`);
          proc.process.kill("SIGKILL");
          this.processes.delete(fileId);
        }
      }
    } catch (err) {
      console.error("[LSP] Cleanup error:", err.message);
    }
  }
}

export default LSPManager;