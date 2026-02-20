// src/services/conflict/analyzers/UnresolvedIdentifierAnalyzer.js

import BaseAnalyzer from "./BaseAnalyzer.js";

/**
 * UnresolvedIdentifierAnalyzer
 *
 * Wraps LSP diagnostics for undefined/unresolved identifiers.
 *
 * EXAMPLES:
 * ✗ console.log(price);  where price is undefined
 * ✗ calculateTotal() but function doesn't exist
 * ✓ console.log(x); where x is declared
 *
 * DETECTION METHOD:
 * 1. Get LSP diagnostics
 * 2. Filter for "undefined identifier" type errors
 * 3. Exclude globals (console, window, etc.)
 * 4. Exclude imports (cross-file)
 * 5. Create conflict for file-level undefined vars
 */
class UnresolvedIdentifierAnalyzer extends BaseAnalyzer {
  constructor() {
    super("UnresolvedIdentifierAnalyzer");

    // Known globals/builtins to exclude
    this.globalSymbols = new Set([
      "console",
      "window",
      "document",
      "globalThis",
      "process",
      "require",
      "module",
      "exports",
      "__dirname",
      "__filename",
      "setInterval",
      "setTimeout",
      "clearInterval",
      "clearTimeout",
      "Array",
      "Object",
      "String",
      "Number",
      "Boolean",
      "Date",
      "Math",
      "JSON",
      "RegExp",
      "Error",
      "Promise",
      "Map",
      "Set",
      "WeakMap",
      "WeakSet",
      "Symbol",
      "Proxy",
      "Reflect",
      "undefined",
      "null",
      "NaN",
      "Infinity",
    ]);
  }

  async analyze(lspContext, fileId, userId) {
    try {
      const { diagnostics, ast } = lspContext;

      if (!diagnostics || diagnostics.length === 0) {
        this.log("No diagnostics available");
        return [];
      }

      const conflicts = [];

      // Filter diagnostics for undefined identifier errors
      const undefinedErrors = diagnostics.filter((diag) => {
        const msg = (diag.message || "").toLowerCase();
        return (
          msg.includes("is not defined") ||
          msg.includes("undefined") ||
          msg.includes("not declared") ||
          msg.includes("not found")
        );
      });

      if (undefinedErrors.length === 0) {
        this.log("No undefined identifier errors found");
        return [];
      }

      // Extract variable names from error messages
      for (const error of undefinedErrors) {
        const symbolName = this._extractSymbolFromError(error.message);

        if (!symbolName) {
          this.log(`Could not extract symbol from error: ${error.message}`);
          continue;
        }

        // Skip if it's a known global
        if (this.globalSymbols.has(symbolName)) {
          this.log(`Skipping global symbol: ${symbolName}`);
          continue;
        }

        // Skip if it looks like a cross-file import
        if (this._looksLikeImport(symbolName, ast)) {
          this.log(`Skipping likely import: ${symbolName}`);
          continue;
        }

        const conflict = this.createConflict({
          type: "unresolved-identifier",
          severity: "blocking",
          symbol: symbolName,
          scope: "global", // File-level scope
          location: {
            startLine: error.range?.start?.line || 0,
            endLine: error.range?.end?.line || 0,
            startColumn: error.range?.start?.character || 0,
            endColumn: error.range?.end?.character || 0,
          },
          relatedSymbols: [symbolName],
          suggestedFix: {
            type: "declare",
            suggestions: [
              `const ${symbolName} = undefined;`,
              `let ${symbolName};`,
              `import { ${symbolName} } from './module';`,
            ],
          },
          metadata: {
            createdBy: userId,
            detectedBy: this.analyzerName,
          },
        });

        conflicts.push(conflict);
        this.log(
          `Found unresolved identifier: '${symbolName}' at line ${conflict.location.startLine}`
        );
      }

      return conflicts;
    } catch (err) {
      this.errorLog("Analysis failed", err);
      return [];
    }
  }

  /**
   * Extract symbol name from LSP diagnostic message
   * Common patterns:
   * - "'x' is not defined"
   * - "name 'y' is not defined"
   * - "'price' cannot be found"
   */
  _extractSymbolFromError(message) {
    if (!message) return null;

    // Try pattern: 'symbolName' is...
    let match = message.match(/'([^']+)'/);
    if (match) return match[1];

    // Try pattern: name 'symbolName' is...
    match = message.match(/name\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (match) return match[1];

    // Try pattern: symbolName is not defined
    match = message.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s+is/);
    if (match) return match[1];

    return null;
  }

  /**
   * Check if symbol looks like it's from an import
   * SIMPLE CHECK: Look for import statements in AST
   */
  _looksLikeImport(symbolName, ast) {
    if (!ast || !ast.body) return false;

    // Look for import statements
    for (const node of ast.body) {
      if (node.type === "ImportDeclaration") {
        // Check if this symbol is imported
        for (const spec of node.specifiers || []) {
          if (spec.local?.name === symbolName) {
            return true; // Already imported
          }
        }
      }
    }

    return false;
  }
}

export default UnresolvedIdentifierAnalyzer;