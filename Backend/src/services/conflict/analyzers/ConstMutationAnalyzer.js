import BaseAnalyzer from "./BaseAnalyzer.js";

/**
 * ConstMutationAnalyzer
 *
 * Detects attempts to reassign const variables.
 *
 * EXAMPLE:
 * ✗ const PI = 3.14; PI = 4;  → CONFLICT
 *
 * DETECTION: Wrap LSP diagnostics for const reassignment errors
 */
class ConstMutationAnalyzer extends BaseAnalyzer {
  constructor() {
    super("ConstMutationAnalyzer");
  }

  async analyze(lspContext, fileId, userId) {
    try {
      const { diagnostics } = lspContext;

      if (!diagnostics) return [];

      const conflicts = [];

      // Filter for const reassignment errors
      const constErrors = diagnostics.filter((diag) => {
        const msg = (diag.message || "").toLowerCase();
        return (
          msg.includes("const") &&
          (msg.includes("reassign") || msg.includes("assign"))
        );
      });

      for (const error of constErrors) {
        const symbolName = this._extractSymbolFromError(error.message);

        if (!symbolName) continue;

        const conflict = this.createConflict({
          type: "const-mutation",
          severity: "blocking",
          symbol: symbolName,
          scope: "global",
          location: {
            startLine: error.range?.start?.line || 0,
            endLine: error.range?.end?.line || 0,
            startColumn: error.range?.start?.character || 0,
            endColumn: error.range?.end?.character || 0,
          },
          relatedSymbols: [symbolName],
          suggestedFix: {
            type: "convert-to-let",
            suggestions: [
              `let ${symbolName} = ...`,
              `Remove the assignment`,
            ],
          },
          metadata: {
            createdBy: userId,
            detectedBy: this.analyzerName,
          },
        });

        conflicts.push(conflict);
        this.log(
          `Found const mutation: '${symbolName}' at line ${conflict.location.startLine}`
        );
      }

      return conflicts;
    } catch (err) {
      this.errorLog("Analysis failed", err);
      return [];
    }
  }

  _extractSymbolFromError(message) {
    // Try pattern: 'symbolName' cannot...
    let match = message.match(/'([^']+)'/);
    if (match) return match[1];

    // Try pattern: variable name...
    match = message.match(/variable\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (match) return match[1];

    return null;
  }
}

export default ConstMutationAnalyzer;

