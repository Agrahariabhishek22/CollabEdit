// src/services/lsp/LSPDocumentSanitizer.js

/**
 * LSPDocumentSanitizer
 *
 * Removes conflict markers from code before sending to LSP.
 * Prevents LSP from crashing on conflict marker syntax.
 *
 * USAGE:
 * const cleanCode = sanitizer.sanitize(codeWithMarkers);
 */
class LSPDocumentSanitizer {
  /**
   * Remove all conflict markers from code
   */
  sanitize(code) {
    if (!code) return code;

    // Remove marker blocks
    // Pattern: <<<<<< CONFLICT (...) ... ======= ... >>>>>>>
    const markerPattern = /<<<<<< CONFLICT.*?\n[\s\S]*?======\n[\s\S]*?>>>>>>>\n?/g;

    const cleaned = code.replace(markerPattern, "");

    return cleaned;
  }

  /**
   * Extract marker information from code
   * Returns array of marker metadata without removing them
   */
  extractMarkers(code) {
    const markers = [];
    const markerPattern = /<<<<<< CONFLICT \(([^)]+)\)\n([\s\S]*?)\n======\n([\s\S]*?)\n>>>>>>>/g;

    let match;
    while ((match = markerPattern.exec(code)) !== null) {
      markers.push({
        user: match[1],
        code: match[2],
        message: match[3],
        fullText: match[0],
        startIndex: match.index,
      });
    }

    return markers;
  }

  /**
   * Check if code has markers
   */
  hasMarkers(code) {
    return /<<<<<< CONFLICT/.test(code);
  }

  /**
   * Remove markers but keep code (extract problematic line)
   */
  extractProblematicCode(code) {
    if (!this.hasMarkers(code)) return code;

    const markers = this.extractMarkers(code);
    let result = code;

    // Replace markers with just the problematic code
    for (const marker of markers) {
      result = result.replace(marker.fullText, marker.code + "\n");
    }

    return result;
  }
}

export default LSPDocumentSanitizer;