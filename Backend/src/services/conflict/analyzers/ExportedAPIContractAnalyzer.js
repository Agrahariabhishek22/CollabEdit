
import BaseAnalyzer from "./BaseAnalyzer.js";

/**
 * ExportedAPIContractAnalyzer
 *
 * Detects when exported functions/variables change signature/structure.
 *
 * EXAMPLE:
 * ✗ export function getUser() {}
 *   changed to: export function getUser(id: number) {}
 *   → API SIGNATURE CHANGED (warning)
 */
class ExportedAPIContractAnalyzer extends BaseAnalyzer {
  constructor() {
    super("ExportedAPIContractAnalyzer");
  }

  async analyze(lspContext, fileId, userId) {
    try {
      // TODO: Track exports and detect changes
      // For now, return empty (placeholder)
      this.log("Export contract detection - coming in extended phase");
      return [];
    } catch (err) {
      this.errorLog("Analysis failed", err);
      return [];
    }
  }
}

export default ExportedAPIContractAnalyzer;