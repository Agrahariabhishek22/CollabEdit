// src/services/conflict/analyzers/BaseAnalyzer.js

import { v4 as uuidv4 } from "uuid";

/**
 * BaseAnalyzer
 *
 * Abstract base class for all 6 conflict analyzers.
 * Provides common structure and utility methods.
 *
 * Each analyzer extends this and implements:
 * - analyze(lspContext, fileId, userId): Promise<ConflictObject[]>
 *
 * PATTERN:
 * 1. Get required data from lspContext (AST, diagnostics, etc.)
 * 2. Perform analysis logic
 * 3. Return array of ConflictObjects (or empty array if no conflicts)
 */
class BaseAnalyzer {
  constructor(analyzerName) {
    this.analyzerName = analyzerName;
  }

  /**
   * Override in subclass
   */
  async analyze(lspContext, fileId, userId) {
    throw new Error("analyze() must be implemented in subclass");
  }

  /**
   * Helper: Create ConflictObject
   * STANDARD FORMAT: All conflicts follow this structure
   */
  createConflict({
    type,
    severity,
    symbol,
    scope,
    location,
    relatedSymbols = [],
    suggestedFix = {},
    metadata = {},
  }) {
    return {
      id: uuidv4(),
      type, // duplicate-declaration | function-signature-drift | etc.
      severity, // blocking | warning
      symbol,
      scope,
      location: {
        startLine: location.startLine || 0,
        endLine: location.endLine || location.startLine || 0,
        startColumn: location.startColumn || 0,
        endColumn: location.endColumn || 0,
      },
      relatedSymbols,
      suggestedFix: {
        type: suggestedFix.type || "manual",
        suggestions: suggestedFix.suggestions || [],
        code: suggestedFix.code || null,
      },
      metadata: {
        createdAt: metadata.createdAt || Date.now(),
        createdBy: metadata.createdBy || "system",
        detectedBy: metadata.detectedBy || this.analyzerName,
        status: metadata.status || "unresolved",
      },
    };
  }

  /**
   * Helper: Extract AST nodes of specific type
   * USAGE:
   * const declarations = this.getNodesByType(ast, "VariableDeclaration");
   */
  getNodesByType(ast, nodeType) {
    if (!ast) return [];

    const nodes = [];

    const traverse = (node) => {
      if (!node) return;

      if (node.type === nodeType) {
        nodes.push(node);
      }

      // Recursively traverse child nodes
      for (const key in node) {
        if (key === "parent" || key === "loc" || key === "range") continue;

        const value = node[key];

        if (Array.isArray(value)) {
          value.forEach((child) => traverse(child));
        } else if (typeof value === "object") {
          traverse(value);
        }
      }
    };

    traverse(ast);
    return nodes;
  }

  /**
   * Helper: Get diagnostics of specific type
   * USAGE:
   * const undefinedErrors = this.getDiagnosticsByType(diagnostics, "undefined");
   */
  getDiagnosticsByType(diagnostics, type) {
    if (!diagnostics) return [];

    return diagnostics.filter((diag) => {
      const message = diag.message?.toLowerCase() || "";
      return message.includes(type.toLowerCase());
    });
  }

  /**
   * Helper: Extract symbol name from node
   * Works for most declaration types
   */
  getSymbolName(node) {
    if (!node) return null;

    // VariableDeclarator: { id: { name: "x" } }
    if (node.id?.name) return node.id.name;

    // FunctionDeclaration: { name: "foo" }
    if (node.name) return node.name;

    // ClassDeclaration: { name: "A" }
    if (node.id?.name) return node.id.name;

    return null;
  }

  /**
   * Helper: Get node location (line, column)
   */
  getNodeLocation(node) {
    if (!node || !node.loc) {
      return {
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
      };
    }

    return {
      startLine: node.loc.start.line - 1, // LSP uses 0-based
      startColumn: node.loc.start.column,
      endLine: node.loc.end.line - 1,
      endColumn: node.loc.end.column,
    };
  }

  /**
   * Helper: Check if node is exported
   */
  isExported(node, ast) {
    if (!ast || !ast.body) return false;

    // Check if there's an ExportNamedDeclaration wrapping this node
    for (const topLevel of ast.body) {
      if (topLevel.type === "ExportNamedDeclaration") {
        if (topLevel.declaration === node) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Helper: Get scope type at given line
   */
  getScopeAtLine(ast, line) {
    // Simple implementation: check if inside function
    if (!ast) return "global";

    const traverse = (node, depth = 0) => {
      if (!node) return "global";

      if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
        if (
          node.loc &&
          node.loc.start.line <= line &&
          node.loc.end.line >= line
        ) {
          return "function";
        }
      }

      if (node.type === "BlockStatement") {
        if (
          node.loc &&
          node.loc.start.line <= line &&
          node.loc.end.line >= line
        ) {
          return "block";
        }
      }

      for (const key in node) {
        if (key === "parent" || key === "loc") continue;

        const value = node[key];

        if (Array.isArray(value)) {
          for (const child of value) {
            const result = traverse(child, depth + 1);
            if (result !== "global") return result;
          }
        } else if (typeof value === "object") {
          const result = traverse(value, depth + 1);
          if (result !== "global") return result;
        }
      }

      return "global";
    };

    return traverse(ast);
  }

  /**
   * Helper: Log analyzer execution
   */
  log(message) {
    console.log(`[${this.analyzerName}] ${message}`);
  }

  errorLog(message, error = null) {
    console.error(`[${this.analyzerName}] ${message}`, error || "");
  }
}

export default BaseAnalyzer;