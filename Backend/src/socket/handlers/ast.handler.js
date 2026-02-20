// src/socket/handlers/ast.handler.js

/**
 * ASTHandler
 *
 * Handles AST-related socket events:
 * - ast:request-tree    (initial tree load)
 * - ast:delta           (periodic delta sync)
 * - ast:viewport        (viewport-based optimization)
 *
 * CALLED BY:
 * - File join event
 * - After each LSP analysis
 */
import crypto from "crypto";
import { prisma } from "../../config/database.js";
import path from "path";

class ASTHandler {
  constructor(io, yjsDocManager, astDeltaCompressor, lspHandler) {
    this.io = io;
    this.yjsDocManager = yjsDocManager;
    this.astDeltaCompressor = astDeltaCompressor;
    this.lspHandler = lspHandler;

    // Language Mapping based on extension
    this.extensionMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.go': 'go',
      '.java': 'java'
    };
  }

  register(socket) {
    // Event: Frontend requests initial AST tree
    socket.on("ast:request-tree", async (data) => {
      await this._handleRequestTree(socket, data);
    });
 
    // Event: Frontend sends viewport info for optimization
    socket.on("ast:viewport-update", async (data) => {
      await this._handleViewportUpdate(socket, data);
    });

    console.log(`[ASTHandler] Events registered for socket ${socket.id}`);
  }

  /**
   * REQUEST TREE (Initial load)
   * Frontend requests full AST when opening file
   */
  async _handleRequestTree(socket, { fileId }) {
    const { userId } = socket;
    const logPrefix = `[AST_REQUEST][User: ${userId}][File: ${fileId}]`;
    const startTime = Date.now();

    console.log(`\n${logPrefix} 📥 Incoming AST Request...`);

    try {
      const fileMeta = await prisma.fileMeta.findUnique({
        where: { id: fileId },
      });

      if (!fileMeta) {
        throw new Error("File metadata not found");
      }

      const extension = path.extname(fileMeta.absolutePath).toLowerCase();
      const language = this.extensionMap[extension] || "javascript"; // Default to JS if unknown

      console.log(
        `${logPrefix} 📄 Language Detected: ${language} from ext: ${extension}`,
      );

      // 2. Get Code
      const code = await this._getCodeFromFile(fileId);
      if (!code) {
        socket.emit("ast:error", { fileId, error: "Could not get code" });
        return;
      }

      // 3. Get LSP Context (Generic Language pass ho rhi hai)
      console.log(`${logPrefix} 🧠 Requesting LSP Context for ${language}...`);
      const lspContext = await this.lspHandler.getLSPContext(
        fileId,
        code,
        language,
      );

      if (!lspContext || !lspContext.ast) {
        console.error(`${logPrefix} ❌ Error: LSP Context or AST is missing.`);
        socket.emit("ast:error", { fileId, error: "Could not get AST" });
        return;
      }
      console.log(`${logPrefix} ✅ LSP Context received.`);

      // 3. Tree Compression
      console.log(`${logPrefix} 🗜️ Compressing tree (Level: 2)...`);
      const compressedTree = this._compressTree(lspContext.ast, 2);
      console.log(
        `${logPrefix} ✅ Tree compressed. Nodes at top level: ${compressedTree.children?.length || 0}`,
      );

      // 4. Checksum calculation
      console.log(`${logPrefix} 🔢 Computing AST Checksum...`);
      const checksum = this._hashAST(lspContext.ast);
      console.log(`${logPrefix} ✅ Checksum generated: ${checksum}`);

      // 5. Emit to frontend
      const payload = {
        fileId,
        tree: compressedTree,
        checksum,
        timestamp: Date.now(),
      };

      socket.emit("ast:tree", payload);

      // Final summary log
      const duration = Date.now() - startTime;
      console.log(`${logPrefix} 🚀 [EMIT] Event: ast:tree`);
      console.log(
        `${logPrefix} 📊 Payload Size: ${JSON.stringify(payload).length} bytes`,
      );
      console.log(`${logPrefix} 🏁 Flow Complete in ${duration}ms.`);
    } catch (err) {
      console.error(`${logPrefix} 🚨 FATAL ERROR:`, err);
      socket.emit("ast:error", { fileId, error: err.message });
    }
  }

  /**
   * BROADCAST DELTA (After LSP analysis)
   * Called from LSPHandler when analysis complete
   */
  async broadcastDelta(fileId, newAST) {
    try {
      // Compute delta
      const delta = this.astDeltaCompressor.computeDelta(fileId, newAST);

      if (delta.changes.length === 0) {
        console.log(`[ASTHandler] No AST changes for ${fileId}`);
        return;
      }

      // Broadcast to all users in file
      this.io.to(`file:${fileId}`).emit("ast:delta", {
        fileId,
        changes: delta.changes,
        checksum: delta.checksum,
        timestamp: delta.timestamp,
      });

      console.log(
        `[ASTHandler] Broadcasted ${delta.changes.length} AST change(s) for ${fileId}`,
      );
    } catch (err) {
      console.error("[ASTHandler] Broadcast delta error:", err);
    }
  }

  /**
   * VIEWPORT UPDATE (Optimization)
   * Frontend tells us which lines are visible
   * We only send AST for those lines
   */
  async _handleViewportUpdate(socket, { fileId, startLine, endLine }) {
    try {
      // TODO: Filter AST to only nodes in viewport range
      // For now, skip (Phase 3.5 optimization)

      console.log(
        `[ASTHandler] Viewport update: ${fileId} lines ${startLine}-${endLine}`,
      );
    } catch (err) {
      console.error("[ASTHandler] Viewport update error:", err);
    }
  }

  /**
   * Helper: Get code from file
   */
  async _getCodeFromFile(fileId) {
    try {
      const docData = await this.yjsDocManager.getOrCreateDoc(fileId);
      return docData?.ytext?.toString() || null;
    } catch (err) {
      console.error("[ASTHandler] Error getting code:", err);
      return null;
    }
  }

  /**
   * Helper: Compress tree (lazy load)
   * Only return top N levels of AST
   */
  _compressTree(ast, maxDepth = 2) {
    const compress = (node, depth) => {
      if (!node || depth > maxDepth) return null;

      const compressed = {
        type: node.type,
        name: node.name,
        line: node.loc?.start?.line,
      };

      // Include children only if not at max depth
      if (depth < maxDepth && node.body && Array.isArray(node.body)) {
        compressed.body = node.body
          .map((child) => compress(child, depth + 1))
          .filter((child) => child !== null);
      }

      return compressed;
    };

    return compress(ast, 0);
  }

  /**
   * Helper: Hash AST
   */
  _hashAST(ast) {
    const astString = JSON.stringify(ast);
    return crypto.createHash("sha256").update(astString).digest("hex");
  }
  _getLanguageFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensionMap[ext] || "javascript";
  }
}
export default ASTHandler;
