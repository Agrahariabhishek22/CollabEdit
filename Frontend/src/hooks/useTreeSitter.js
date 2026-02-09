import { useEffect, useRef, useState } from "react";
// import * as Parser from "web-tree-sitter";

let parserInstance = null;
let languages = {};

// 🟢 Language configurations
const LANGUAGE_URLS = {
  javascript:
    "https://cdn.jsdelivr.net/npm/tree-sitter-javascript@0.20.3/tree-sitter-javascript.wasm",
  typescript:
    "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.20.8/tree-sitter-typescript.wasm",
  cpp: "https://cdn.jsdelivr.net/npm/tree-sitter-cpp@0.20.8/tree-sitter-cpp.wasm",
  java: "https://cdn.jsdelivr.net/npm/tree-sitter-java@0.20.2/tree-sitter-java.wasm",
  jsx: "https://cdn.jsdelivr.net/npm/tree-sitter-javascript@0.20.3/tree-sitter-javascript.wasm",
  tsx: "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.20.8/tree-sitter-typescript.wasm",
  python:
    "https://cdn.jsdelivr.net/npm/tree-sitter-python@0.20.4/tree-sitter-python.wasm",
};

// 🟢 Initialize parser once globally
const initializeParser = async () => {
  if (parserInstance) return parserInstance;

  try {
    console.log("[Tree-sitter] Initializing engine...");

    const TS = window.TreeSitter; // index.html wala script
    if (!TS) throw new Error("TreeSitter global not found!");

    // Engine init
    await TS.init({
      locateFile: (scriptName) =>
        `https://cdn.jsdelivr.net/npm/web-tree-sitter@0.20.8/${scriptName}`,
    });

    parserInstance = new TS();
    console.log("[Tree-sitter] Engine Ready ✅");
    return parserInstance;
  } catch (err) {
    console.error("[Tree-sitter] Init Error:", err);
    throw err;
  }
};

// 🟢 Load language grammar (Corrected version)
const loadLanguage = async (language) => {
  if (languages[language]) return languages[language];

  const TS = window.TreeSitter; // Dubara window se hi uthao static methods ke liye

  try {
    const url = LANGUAGE_URLS[language];
    if (!url) throw new Error(`Language "${language}" not supported`);

    console.log(`[Tree-sitter] Fetching ${language} WASM...`);

    // ✅ Seedha TS.Language.load use karo, manually WebAssembly instantiate karne ki zaroorat nahi hai
    // Ye Tree-sitter ka built-in method hai jo zyada stable hai
    const lang = await TS.Language.load(url);

    languages[language] = lang;
    return lang;
  } catch (err) {
    console.error(`[Tree-sitter] Failed to load ${language}:`, err);
    throw err;
  }
};

export function useTreeSitter(content, language = "javascript") {
  const [tree, setTree] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  const parserRef = useRef(null);
  const languageRef = useRef(null);
  const lastContentRef = useRef("");

  // 🟢 1. Initialize parser & language
  useEffect(() => {
    const setup = async () => {
      try {
        if (!parserRef.current) {
          parserRef.current = await initializeParser();
          console.log("[Tree-sitter] 🛠️ Parser Initialized");
        }

        if (language !== languageRef.current?.type) {
          const lang = await loadLanguage(language);
          languageRef.current = lang;
          parserRef.current.setLanguage(lang);
          console.log(`[Tree-sitter] 🌐 Language switched to: ${language}`);
        }
        setLoading(false);
      } catch (err) {
        console.error("[Tree-sitter] ❌ Setup error:", err);
        setLoading(false);
      }
    };
    setup();
  }, [language]);

  // 🟢 2. Parse content incrementally with Heavy Logging
  useEffect(() => {
    const currentContent = content || "";

    if (
      loading ||
      !parserRef.current ||
      currentContent === lastContentRef.current
    ) {
      return;
    }

    // 🟢 REMOVE debounce - parse immediately for live errors
    try {
      console.time("[Tree-sitter]");

      const newTree = parserRef.current.parse(currentContent, tree);

      // 🟢 CRITICAL: Ref को immediately update करो
      lastContentRef.current = currentContent;

      // 🟢 Enhanced error detection
      const foundErrors = findSyntaxErrors(newTree, currentContent);

      // 🟢 Also check for incomplete patterns
      // const patternErrors = findPatternErrors(currentContent);
      const allErrors = [...foundErrors];

      setTree(newTree);
      setErrors(allErrors);

      console.timeEnd("[Tree-sitter]");
      console.log(`[Tree-sitter Live] ✅ Errors: ${allErrors.length}`);

      if (allErrors.length > 0) {
        console.warn("[Tree-sitter] Live Errors:", allErrors);
      }
    } catch (err) {
      console.error("[Tree-sitter] Parse error:", err);
    }
  }, [content, loading, tree]);
  // function findPatternErrors(content) {
  //   const errors = [];
  //   const lines = content.split("\n");

  //   lines.forEach((line, lineIdx) => {
  //     const trimmed = line.trim();

  //     // ❌ const/let/var without assignment
  //     if (/^(const|let|var)\s+\w+\s*[=;]?\s*$/.test(trimmed)) {
  //       if (trimmed.endsWith("=") || trimmed.endsWith("=;")) {
  //         errors.push({
  //           type: "incomplete_assignment",
  //           message: "Incomplete assignment - value expected",
  //           line: lineIdx,
  //           column: trimmed.length,
  //           startIndex: content.indexOf(
  //             trimmed,
  //             content.indexOf(`\n${lineIdx}`) + 1,
  //           ),
  //           endIndex: content.indexOf(trimmed) + trimmed.length,
  //         });
  //       }
  //     }

  //     // ❌ if/for/while without proper closing
  //     if (/^(if|for|while|function)\s*\([^)]*$/.test(trimmed)) {
  //       if (!trimmed.includes(")")) {
  //         errors.push({
  //           type: "unclosed_parenthesis",
  //           message: "Missing closing parenthesis",
  //           line: lineIdx,
  //           column: trimmed.length,
  //           startIndex: content.indexOf(trimmed),
  //           endIndex: content.indexOf(trimmed) + trimmed.length,
  //         });
  //       }
  //     }

  //     // ❌ Opening brace without closing
  //     const openBraces = (trimmed.match(/\{/g) || []).length;
  //     const closeBraces = (trimmed.match(/\}/g) || []).length;
  //     if (openBraces > closeBraces) {
  //       errors.push({
  //         type: "unclosed_brace",
  //         message: "Missing closing brace '}'",
  //         line: lineIdx,
  //         column: trimmed.length,
  //         startIndex: content.indexOf(trimmed),
  //         endIndex: content.indexOf(trimmed) + trimmed.length,
  //       });
  //     }

  //     // ❌ Missing closing parenthesis
  //     const openParens = (trimmed.match(/\(/g) || []).length;
  //     const closeParens = (trimmed.match(/\)/g) || []).length;
  //     if (openParens > closeParens) {
  //       errors.push({
  //         type: "unclosed_parenthesis",
  //         message: "Missing closing parenthesis ')'",
  //         line: lineIdx,
  //         column: trimmed.length,
  //         startIndex: content.indexOf(trimmed),
  //         endIndex: content.indexOf(trimmed) + trimmed.length,
  //       });
  //     }
  //   });
  //   return errors;
  // }

  return { tree, errors, loading };
}

// 🟢 Find syntax errors in AST
function findSyntaxErrors(tree, content) {
  const errors = [];
  const cursor = tree.walk(); // 🟢 Tree-sitter ka official cursor

  let reachedEnd = false;
  while (!reachedEnd) {
    const node = cursor.currentNode();

    // 🔴 Agar node ERROR hai ya MISSING hai (jaise bracket bhool gaye)
    if (node.type === "ERROR" || node.isMissing()) {
      const { startPosition, endPosition } = node;

      errors.push({
        type: "syntax_error",
        message: node.isMissing()
          ? `Missing: "${node.type}"`
          : `Unexpected token: "${content.substring(node.startIndex, node.endIndex).substring(0, 20)}"`,
        line: startPosition.row,
        column: startPosition.column,
        endLine: endPosition.row,
        endColumn: endPosition.column,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }

    // 🟡 Tree mein aage badhne ka logic
    if (cursor.gotoFirstChild()) {
      continue;
    }

    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) {
        reachedEnd = true;
        break;
      }
    }
  }

  return errors;
}
// 🟢 Get indent level at cursor
export function getIndentLevelAtCursor(tree, cursorIndex) {
  if (!tree) return 0;

  let depth = 0;

  function traverse(node) {
    if (node.startIndex <= cursorIndex && cursorIndex <= node.endIndex) {
      if (
        [
          "block",
          "function_declaration",
          "function_expression",
          "if_statement",
          "for_statement",
          "while_statement",
          "do_statement",
          "class_declaration",
          "method_definition",
          "arrow_function",
          "object",
          "array",
          "compound_statement", // C++
          "translation_unit", // C++
        ].includes(node.type)
      ) {
        depth++;
      }

      for (let child of node.children || []) {
        traverse(child);
      }
    }
  }

  traverse(tree.rootNode);
  return depth;
}

// 🟢 Check if inside function/block
export function isInsideBlock(tree, cursorIndex) {
  if (!tree) return false;

  let inside = false;

  function traverse(node) {
    if (node.startIndex <= cursorIndex && cursorIndex <= node.endIndex) {
      if (
        [
          "block",
          "function_declaration",
          "function_expression",
          "class_declaration",
          "object",
          "array",
        ].includes(node.type)
      ) {
        inside = true;
      }

      for (let child of node.children || []) {
        traverse(child);
      }
    }
  }

  traverse(tree.rootNode);
  return inside;
}
