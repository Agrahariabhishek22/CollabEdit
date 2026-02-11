// TreeSitterManager.js
let parserInstance = null;
const languages = {};

const TreeSitterManager = {
  // 1. Singleton initialization - Updated for v0.23.2 (ABI 15)
  async getParser() {
    if (parserInstance) return parserInstance;

    const TS = window.TreeSitter;
    if (!TS) {
      // Agar turant nahi milti, toh 100ms wait karke fir try karo
      console.warn("TreeSitter not found on window, retrying...");
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getParser(); 
    }

    try {
      // Important: 0.23.2 requires the engine WASM to match the JS version
      await TS.init({
        locateFile: (scriptName) => `/parsers/${scriptName}`,
      });

      parserInstance = new TS();
      return parserInstance;
    } catch (err) {
      console.error("[TreeSitterManager] Initialization failed. Check if tree-sitter.wasm is v0.23.2:", err);
      throw err;
    }
  },

  // 2. Optimized language loading with Version Guard
  async loadLanguage(langName) {
    if (languages[langName]) return languages[langName];

    const TS = window.TreeSitter;
    const url = `/parsers/tree-sitter-${langName}.wasm`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch grammar for ${langName}: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      
      // Binary check: Magic Number (0x00 0x61 0x73 0x6d)
      const uint8 = new Uint8Array(buffer);
      if (uint8[0] !== 0x00 || uint8[1] !== 0x61 || uint8[2] !== 0x73 || uint8[3] !== 0x6d) {
        throw new Error(`Invalid WASM binary for ${langName}. Check your download script.`);
      }

      // v0.23.2 loading
      const lang = await TS.Language.load(uint8);
      languages[langName] = lang;
      return lang;
    } catch (err) {
      // ABI Version Mismatch Handle
      if (err.message.includes("version 15") || err.message.includes("ABI")) {
        console.error(`[TreeSitterManager] VERSION MISMATCH for ${langName}!`);
        console.error("The Grammar is ABI 15 (New), but your JS library in index.html is too old (ABI 13/14).");
        console.warn("FIX: Make sure <script src='/parsers/tree-sitter.js'> is using the 0.23.2 version.");
      }
      throw err;
    }
  }
};

export default TreeSitterManager;