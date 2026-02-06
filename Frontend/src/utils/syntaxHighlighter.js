/**
 * Syntax Highlighter Utility
 * 
 * Currently a placeholder for Tree-sitter WASM integration
 * This will be replaced with actual Tree-sitter implementation
 */

const KEYWORDS = {
  javascript: [
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
  ],
  python: [
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
  ],
  java: [
    "abstract",
    "assert",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "false",
    "final",
    "finally",
    "float",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "true",
    "try",
    "void",
    "volatile",
    "while",
  ],
};

/**
 * Get keywords for a specific language
 * @param {string} language - Language identifier (js, python, java, etc.)
 * @returns {string[]} Array of keywords
 */
export const getKeywords = (language) => {
  const lang = language?.toLowerCase() || "javascript";
  return KEYWORDS[lang] || KEYWORDS.javascript;
};

/**
 * Highlight code with basic HTML markup (placeholder)
 * 
 * TODO: Replace with actual Tree-sitter WASM implementation
 * This is a very basic implementation that just escapes HTML
 * 
 * @param {string} code - Code to highlight
 * @param {string} language - Language identifier
 * @returns {string} HTML string with syntax highlighting
 */
export const highlightCode = (code, language = "javascript") => {
  if (!code) return "";

  // Basic HTML escaping
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // TODO: Add actual syntax highlighting here
  // For now, just return escaped code
  return `<span class="text-slate-300">${escaped}</span>`;
};

/**
 * Tokenize code into an AST structure (placeholder)
 * 
 * TODO: Integrate Tree-sitter WASM here
 * 
 * @param {string} code - Code to tokenize
 * @param {string} language - Language identifier
 * @returns {Object} AST structure
 */
export const tokenizeCode = (code, language = "javascript") => {
  // Placeholder implementation
  return {
    type: "program",
    body: [
      {
        type: "token",
        value: code,
        kind: "text",
      },
    ],
  };
};

/**
 * Get diagnostics for code (placeholder - will use LSP)
 * 
 * TODO: This will be handled by LSP server
 * 
 * @param {string} code - Code to analyze
 * @param {string} language - Language identifier
 * @returns {Object[]} Array of diagnostic objects
 */
export const getDiagnostics = (code, language = "javascript") => {
  const diagnostics = [];

  // Placeholder: Basic bracket matching
  const lines = code.split("\n");
  let openBraces = 0;

  lines.forEach((line, lineIndex) => {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "{" || line[i] === "[" || line[i] === "(") {
        openBraces++;
      }
      if (line[i] === "}" || line[i] === "]" || line[i] === ")") {
        openBraces--;
      }
    }

    if (openBraces < 0) {
      diagnostics.push({
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length },
        },
        message: "Unmatched closing bracket",
        severity: "error",
      });
      openBraces = 0; // Reset
    }
  });

  if (openBraces > 0) {
    diagnostics.push({
      range: {
        start: { line: lines.length - 1, character: 0 },
        end: { line: lines.length - 1, character: 0 },
      },
      message: `Missing ${openBraces} closing bracket(s)`,
      severity: "error",
    });
  }

  return diagnostics;
};
