// src/services/lsp/LSPRouter.js

import path from "path";

/**
 * LSPRouter
 * 
 * PURPOSE: Detect language from file extension and route to correct LSP server
 * 
 * RESPONSIBILITIES:
 * 1. Language detection from file extension
 * 2. LSP server configuration for each language
 * 3. Fallback handling for unsupported languages
 * 
 * SUPPORTED LANGUAGES:
 * - JavaScript/TypeScript (.js, .jsx, .ts, .tsx)
 * - Python (.py)
 * - Java (.java)
 * - C/C++ (.c, .cpp, .h, .hpp)
 * - Go (.go)
 */

class LSPRouter {
  constructor() {
    // ═══════════════════════════════════════════════════════
    // LSP SERVER CONFIGURATIONS
    // ═══════════════════════════════════════════════════════
    this.lspConfigs = {
      javascript: {
        command: "typescript-language-server",
        args: ["--stdio"],
        extensions: [".js", ".jsx", ".mjs", ".cjs"],
        languageId: "javascript",
      },
      typescript: {
        command: "typescript-language-server",
        args: ["--stdio"],
        extensions: [".ts", ".tsx"],
        languageId: "typescript",
      },
      python: {
        command: "pyright-langserver",
        args: ["--stdio"],
        extensions: [".py"],
        languageId: "python",
      },
      java: {
        command: "jdtls",
        args: [],
        extensions: [".java"],
        languageId: "java",
      },
      cpp: {
        command: "clangd",
        args: ["--background-index", "--clang-tidy"],
        extensions: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"],
        languageId: "cpp",
      },
      go: {
        command: "gopls",
        args: ["serve"],
        extensions: [".go"],
        languageId: "go",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // DETECT LANGUAGE FROM FILE PATH
  // ═══════════════════════════════════════════════════════════

  /**
   * Detect language from file extension
   * 
   * @param {string} filePath - File path or name
   * @returns {string|null} - Language key or null if unsupported
   */
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    for (const [language, config] of Object.entries(this.lspConfigs)) {
      if (config.extensions.includes(ext)) {
        return language;
      }
    }

    console.warn(`[LSPRouter] Unsupported file extension: ${ext}`);
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // GET LSP CONFIG FOR LANGUAGE
  // ═══════════════════════════════════════════════════════════

  /**
   * Get LSP configuration for a language
   * 
   * @param {string} language - Language key (e.g., 'javascript')
   * @returns {Object|null} - LSP config or null
   */
  getConfig(language) {
    return this.lspConfigs[language] || null;
  }

  // ═══════════════════════════════════════════════════════════
  // GET CONFIG BY FILE PATH
  // ═══════════════════════════════════════════════════════════

  /**
   * Get LSP config directly from file path
   * Convenience method combining detection + config
   * 
   * @param {string} filePath - File path
   * @returns {Object|null} - LSP config or null
   */
  getConfigByPath(filePath) {
    const language = this.detectLanguage(filePath);
    if (!language) return null;

    return {
      language,
      ...this.lspConfigs[language],
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHECK IF LANGUAGE IS SUPPORTED
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if a file is supported by any LSP
   * 
   * @param {string} filePath - File path
   * @returns {boolean} - True if supported
   */
  isSupported(filePath) {
    return this.detectLanguage(filePath) !== null;
  }

  // ═══════════════════════════════════════════════════════════
  // GET ALL SUPPORTED EXTENSIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Get list of all supported file extensions
   * 
   * @returns {Array<string>} - List of extensions
   */
  getSupportedExtensions() {
    const extensions = new Set();

    for (const config of Object.values(this.lspConfigs)) {
      config.extensions.forEach(ext => extensions.add(ext));
    }

    return Array.from(extensions);
  }

  // ═══════════════════════════════════════════════════════════
  // GET LANGUAGE ID FOR LSP PROTOCOL
  // ═══════════════════════════════════════════════════════════

  /**
   * Get language ID for LSP textDocument/didOpen
   * 
   * @param {string} filePath - File path
   * @returns {string|null} - Language ID for LSP
   */
  getLanguageId(filePath) {
    const language = this.detectLanguage(filePath);
    if (!language) return null;

    return this.lspConfigs[language].languageId;
  }
}

export default LSPRouter;