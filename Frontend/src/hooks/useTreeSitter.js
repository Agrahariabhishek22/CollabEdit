import { useEffect, useRef, useState } from "react";
import { findSyntaxErrors } from "./ErrorDetection";
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

export function useTreeSitter(
  content,
  language = "javascript",
  editData = null,
) {
  const [tree, setTree] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  const parserRef = useRef(null);
  const lastContentRef = useRef("");

  // 🟢 Phase 1: Engine & Language Setup
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      setLoading(true);
      try {
        // ✅ Local functions use kiye (TreeSitterManager ki jagah)
        const parser = await initializeParser();
        const lang = await loadLanguage(language);

        if (mounted) {
          parser.setLanguage(lang);
          parserRef.current = parser;

          // Initial Parse
          const initialTree = parser.parse(content || "");
          setTree(initialTree);
          setLoading(false);
        }
      } catch (err) {
        console.error("[useTreeSitter] Setup Failed:", err);
        if (mounted) setLoading(false);
      }
    };

    setup();
    return () => {
      mounted = false;
    };
  }, [language]); // Jab language change hogi, tabhi setup dobara chalega

  // 🟢 Phase 2: Live Parsing (Incremental + Error Detection)
  useEffect(() => {
    // Parser ready nahi hai ya loading ho rahi hai toh ruko
    if (loading || !parserRef.current) return;

    const currentContent = content || "";

    // Agar content change nahi hua aur editData bhi nahi hai toh skip
    if (currentContent === lastContentRef.current && !editData) return;

    let newTree;

    try {
      // 🟢 INCREMENTAL PARSE: Agar purana tree aur editData (indices) available hain
      if (tree && editData) {
        // tree.edit method purane tree ko modify karta hai mapping ke liye
        tree.edit(editData);
        // parser.parse(content, oldTree) incremental parsing trigger karta hai
        newTree = parserRef.current.parse(currentContent, tree);
      } else {
        // 🟡 FULL RE-PARSE: Initial load ya editData missing hone par
        newTree = parserRef.current.parse(currentContent);
      }

      // Syntax errors calculate karo
      const syntaxErrors = findSyntaxErrors(newTree, currentContent);

      // Refs aur State update karo
      lastContentRef.current = currentContent;
      setTree(newTree);
      setErrors(syntaxErrors);
    } catch (err) {
      console.error("[useTreeSitter] Parsing Error:", err);
    }
  }, [content, loading, editData]);

  return { tree, errors, loading };
}

// 🟢 Find syntax errors in AST
// function findSyntaxErrors(tree, content) {
//   const errors = [];
//   const cursor = tree.walk(); // 🟢 Tree-sitter ka official cursor

//   let reachedEnd = false;
//   while (!reachedEnd) {
//     const node = cursor.currentNode();

//     // 🔴 Agar node ERROR hai ya MISSING hai (jaise bracket bhool gaye)
//     if (node.type === "ERROR" || node.isMissing()) {
//       const { startPosition, endPosition } = node;

//       errors.push({
//         type: "syntax_error",
//         message: node.isMissing()
//           ? `Missing: "${node.type}"`
//           : `Unexpected token: "${content.substring(node.startIndex, node.endIndex).substring(0, 20)}"`,
//         line: startPosition.row,
//         column: startPosition.column,
//         endLine: endPosition.row,
//         endColumn: endPosition.column,
//         startIndex: node.startIndex,
//         endIndex: node.endIndex,
//       });
//     }

//     // 🟡 Tree mein aage badhne ka logic
//     if (cursor.gotoFirstChild()) {
//       continue;
//     }

//     while (!cursor.gotoNextSibling()) {
//       if (!cursor.gotoParent()) {
//         reachedEnd = true;
//         break;
//       }
//     }
//   }

//   return errors;
// }
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
