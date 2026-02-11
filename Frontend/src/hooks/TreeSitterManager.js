// TreeSitterManager.js
let parserInstance = null;
const languages = {};

const TreeSitterManager = {
  // 1. Singleton initialization
  async getParser() {
    if (parserInstance) return parserInstance;

    const TS = window.TreeSitter;
    if (!TS) throw new Error("Tree-sitter library not loaded in index.html");

    await TS.init({
      locateFile: (scriptName) => `/parsers/${scriptName}`,
    });

    parserInstance = new TS();
    return parserInstance;
  },

  // 2. Optimized language loading with Buffer check
  async loadLanguage(langName) {
    if (languages[langName]) return languages[langName];

    const TS = window.TreeSitter;
    const url = `/parsers/tree-sitter-${langName}.wasm`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const buffer = await response.arrayBuffer();
      
      // Binary check (No more HTML surprises!)
      const uint8 = new Uint8Array(buffer);
      if (uint8[0] !== 0 || uint8[1] !== 0x61 || uint8[2] !== 0x73 || uint8[3] !== 0x6d) {
        throw new Error("Invalid WASM binary (Magic number mismatch)");
      }

      const lang = await TS.Language.load(uint8);
      languages[langName] = lang;
      return lang;
    } catch (err) {
      console.error(`[TreeSitterManager] Failed to load ${langName}:`, err);
      throw err;
    }
  }
};

export default TreeSitterManager;