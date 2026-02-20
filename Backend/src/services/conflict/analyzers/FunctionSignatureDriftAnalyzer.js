
import BaseAnalyzer from "./BaseAnalyzer.js";

/**
 * FunctionSignatureDriftAnalyzer
 *
 * Detects when function signature changes (params, return type)
 * and breaks existing call sites.
 *
 * EXAMPLE:
 * ✗ function calc(a: number) {...}
 *   then changed to: function calc(a: string) {...}
 *   with calls: calc(42)  → TYPE MISMATCH
 */
class FunctionSignatureDriftAnalyzer extends BaseAnalyzer {
  constructor() {
    super("FunctionSignatureDriftAnalyzer");
  }

  async analyze(lspContext, fileId, userId) {
    try {
      // TODO: Implement full signature tracking
      // For now, return empty (placeholder)
      this.log("Signature drift detection - coming in extended phase");
      return [];
    } catch (err) {
      this.errorLog("Analysis failed", err);
      return [];
    }
  }
}

export default FunctionSignatureDriftAnalyzer;