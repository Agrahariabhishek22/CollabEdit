// src/services/conflict/ConflictDetector.js
// FIXED - Calls LSPHandler for parsing, no duplication

import { v4 as uuidv4 } from "uuid";
import DuplicateDeclarationAnalyzer from "./analyzers/DuplicateDeclarationAnalyzer.js";
import FunctionSignatureDriftAnalyzer from "./analyzers/FunctionSignatureDriftAnalyzer.js";
import ConstMutationAnalyzer from "./analyzers/ConstMutationAnalyzer.js";
import ExportedAPIContractAnalyzer from "./analyzers/ExportedAPIContractAnalyzer.js";
import ShadowingAnalyzer from "./analyzers/ShadowingAnalyzer.js";
import UnresolvedIdentifierAnalyzer from "./analyzers/UnresolvedIdentifierAnalyzer.js";
import crypto from "crypto";

class ConflictDetector {
  constructor(redis, lspHandler) {
    // 🔴 CHANGE: Take lspHandler instead of lspManager
    this.redis = redis;
    this.lspHandler = lspHandler;

    this.analyzers = [
      new DuplicateDeclarationAnalyzer(),
      // new FunctionSignatureDriftAnalyzer(),
      // new ConstMutationAnalyzer(),
      // new ExportedAPIContractAnalyzer(),
      // new ShadowingAnalyzer(),
      // new UnresolvedIdentifierAnalyzer(),
    ];

    this.astHashCache = new Map();
  }

  /**
   * Main analysis method
   *
   * FLOW (SIMPLIFIED):
   * 1. Skip whitespace
   * 2. Get AST from LSPHandler (proper parsing, no duplication)
   * 3. Get diagnostics from Redis
   * 4. Check hash (cache)
   * 5. Run analyzers
   * 6. Deduplicate
   * 7. Return conflicts
   */
  async analyze(params) {
    const { fileId, code, language, userId } = params;

    if (!fileId || !code || !language || !userId) {
      console.error("[ConflictDetector] Missing required params");
      return [];
    }

    try {
      // Skip whitespace
      if (this._isWhitespaceOnly(code)) {
        console.log(`[ConflictDetector] Skipping whitespace-only change`);
        return [];
      }

      // ════════════════════════════════════════════════════════════
      // GET AST FROM LSPHandler (Proper parsing, no duplication)
      // ════════════════════════════════════════════════════════════

      let ast = null;

      if (this.lspHandler && this.lspHandler._parseToAST) {
        // Call LSPHandler's proper parser
        ast = await this.lspHandler._parseToAST(code, language);
        // console.log("[Conflict Detector] this is the ast: ", ast);
      } else {
        // Fallback to simple parsing (shouldn't happen in prod)
        console.warn(
          "[ConflictDetector] LSPHandler not available, using fallback parser",
        );
        ast = this._parseBasicAST(code, language);
      }

      if (!ast) {
        console.error("[ConflictDetector] Failed to parse AST");
        return [];
      }

      // ════════════════════════════════════════════════════════════
      // GET DIAGNOSTICS (Already in Redis from LSP)
      // ════════════════════════════════════════════════════════════

      let diagnostics = [];
      try {
        const diagnosticsJson = await this.redis.get(
          `lsp:diagnostics:${fileId}`,
        );
        if (diagnosticsJson) {
          diagnostics = JSON.parse(diagnosticsJson);
        }
      } catch (err) {
        console.warn("[ConflictDetector] Could not get diagnostics");
      }

      // ════════════════════════════════════════════════════════════
      // CHECK HASH (Skip if unchanged)
      // ════════════════════════════════════════════════════════════

      const currentHash = this._hashAST(ast);
      const previousHash = this.astHashCache.get(fileId);

      if (previousHash && previousHash === currentHash) {
        console.log(`[ConflictDetector] AST unchanged, skipping`);
        return [];
      }

      this.astHashCache.set(fileId, currentHash);

      // ════════════════════════════════════════════════════════════
      // RUN ANALYZERS
      // ════════════════════════════════════════════════════════════

      const lspContext = {
        ast,
        diagnostics,
        code,
        language,
      };

      const conflicts = [];

      for (const analyzer of this.analyzers) {
        try {
          const analyzerConflicts = await analyzer.analyze(
            lspContext,
            fileId,
            userId,
          );

          if (analyzerConflicts && analyzerConflicts.length > 0) {
            conflicts.push(...analyzerConflicts);
            console.log(
              `[ConflictDetector] ${analyzer.constructor.name} found ${analyzerConflicts.length} conflict(s)`,
            );
          }
        } catch (err) {
          console.error(
            `[ConflictDetector] ${analyzer.constructor.name} error:`,
            err.message,
          );
        }
      }

      // ════════════════════════════════════════════════════════════
      // DEDUPLICATE
      // ════════════════════════════════════════════════════════════

      const deduplicatedConflicts = await this._deduplicateConflicts(
        fileId,
        conflicts,
      );

      console.log(
        `[ConflictDetector] Found ${deduplicatedConflicts.length} unique conflict(s)`,
      );

      return deduplicatedConflicts;
      // return conflicts;
    } catch (err) {
      console.error("[ConflictDetector] Analysis error:", err);
      return [];
    }
  }

  /**
   * Store conflicts in Redis
   */
  async storeConflicts(fileId, conflicts) {
    try {
      if (!conflicts || conflicts.length === 0) {
        await this.redis.del(`conflicts:${fileId}`);
        return true;
      }

      const conflictMap = {};
      for (const conflict of conflicts) {
        conflictMap[conflict.id] = JSON.stringify(conflict);
      }

      await this.redis.hSet(`conflicts:${fileId}`, conflictMap);
      await this.redis.expire(`conflicts:${fileId}`, 86400);

      console.log(`[ConflictDetector] Stored ${conflicts.length} conflict(s)`);
      return true;
    } catch (err) {
      console.error("[ConflictDetector] Store error:", err);
      return false;
    }
  }

  /**
   * Get conflicts from Redis
   */
  async getConflicts(fileId) {
    try {
      const conflictData = await this.redis.hGetAll(`conflicts:${fileId}`);
      if (!conflictData || Object.keys(conflictData).length === 0) {
        return [];
      }

      return Object.values(conflictData).map((jsonStr) => JSON.parse(jsonStr));
    } catch (err) {
      console.error("[ConflictDetector] Get conflicts error:", err);
      return [];
    }
  }

  /**
   * Fallback: Basic AST parsing (regex-based)
   * Only used if LSPHandler not available
   */
  _parseBasicAST(code, language) {
    try {
      if (!code) return { type: "Program", body: [] };

      const declarations = [];

      // Variable declarations
      const varRegex = /(?:const|let|var)\s+(\w+)/g;
      let match;
      while ((match = varRegex.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split("\n").length - 1;
        declarations.push({
          type: "VariableDeclaration",
          name: match[1],
          loc: { start: { line: lineNum } },
        });
      }

      // Function declarations
      const funcRegex = /function\s+(\w+)\s*\(/g;
      while ((match = funcRegex.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split("\n").length - 1;
        declarations.push({
          type: "FunctionDeclaration",
          name: match[1],
          loc: { start: { line: lineNum } },
        });
      }

      // Class declarations
      const classRegex = /class\s+(\w+)/g;
      while ((match = classRegex.exec(code)) !== null) {
        const lineNum = code.substring(0, match.index).split("\n").length - 1;
        declarations.push({
          type: "ClassDeclaration",
          name: match[1],
          loc: { start: { line: lineNum } },
        });
      }

      return { type: "Program", body: declarations };
    } catch (err) {
      console.error("[ConflictDetector] Parse error:", err);
      return { type: "Program", body: [] };
    }
  }

  /**
   * Deduplicate conflicts
   */
  async _deduplicateConflicts(fileId, newConflicts) {
    try {
      // 1. Redis se purane conflicts uthao
      const existingConflicts = await this.getConflicts(fileId);

      // Agar naya koi conflict nahi hai, toh purani list return karne ki zarurat nahi (unless resolved ho)
      if (!newConflicts || newConflicts.length === 0) {
        // Sirf wahi purane bacha ke rakho jo user ne 'resolved' mark kiye hain
        return existingConflicts.filter(
          (c) => c.metadata?.status === "resolved",
        );
      }

      const deduped = [];
      const processedKeys = new Set();

      // 2. Purane conflicts ka map banao (Type + Symbol + Scope) ke basis par
      const existingMap = new Map();
      existingConflicts.forEach((c) => {
        const key = `${c.type}:${c.symbol}:${c.scope}`;
        existingMap.set(key, c);
      });

      // 3. Naye conflicts ko process karo
      for (const newConflict of newConflicts) {
        const key = `${newConflict.type}:${newConflict.symbol}:${newConflict.scope}`;

        if (processedKeys.has(key)) continue; // Current batch mein double entry na ho

        const existing = existingMap.get(key);

        if (existing) {
          // 🔥 FIX: Skip karne ke bajaye, purane ki ID copy karo par data NAYA use karo
          newConflict.id = existing.id;

          // Purana status (like 'resolved' or 'ignored') carry forward karo
          if (existing.metadata) {
            newConflict.metadata.status =
              existing.metadata.status || "unresolved";
          }

          console.log(`[ConflictDetector] Updated existing conflict: ${key}`);
        } else {
          // Naya conflict hai, nayi ID do
          newConflict.id = uuidv4();
          console.log(`[ConflictDetector] New conflict detected: ${key}`);
        }

        deduped.push(newConflict);
        processedKeys.add(key);
      }

      // 4. (Optional) Purane 'resolved' conflicts jo ab naye scan mein nahi aaye, unhe bhi rakho
      for (const [key, existing] of existingMap) {
        if (
          !processedKeys.has(key) &&
          existing.metadata?.status === "resolved"
        ) {
          deduped.push(existing);
        }
      }

      return deduped;
    } catch (err) {
      console.error("[ConflictDetector] Dedup error:", err);
      return newConflicts; // Error case mein naye wale toh bhej hi do
    }
  }

  _isWhitespaceOnly(code) {
    return code.trim().length === 0 || /^\s*$/.test(code);
  }

  _hashAST(ast) {
    const astString = JSON.stringify(ast);
    return crypto.createHash("sha256").update(astString).digest("hex");
  }
}

export default ConflictDetector;
