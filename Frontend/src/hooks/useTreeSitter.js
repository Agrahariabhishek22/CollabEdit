// hooks/useTreeSitter.js

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
  jsx: "https://cdn.jsdelivr.net/npm/tree-sitter-javascript@0.20.3/tree-sitter-javascript.wasm", // Same as JS
  tsx: "https://cdn.jsdelivr.net/npm/tree-sitter-typescript@0.20.8/tree-sitter-typescript.wasm",
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

  // 🟢 Initialize parser & language once
  useEffect(() => {
    const setup = async () => {
      try {
        if (!parserRef.current) {
          parserRef.current = await initializeParser();
        }

        if (language !== languageRef.current?.type) {
          const lang = await loadLanguage(language);
          languageRef.current = lang;
          parserRef.current.setLanguage(lang);
          console.log(`[Tree-sitter] Language set to ${language}`);
        }

        setLoading(false);
      } catch (err) {
        console.error("[Tree-sitter] Setup error:", err);
        setLoading(false);
      }
    };

    setup();
  }, [language]);

  // 🟢 Parse content incrementally
  useEffect(() => {
    if (loading || !parserRef.current || content === lastContentRef.current) {
      return;
    }

    const parseCode = () => {
      try {
        console.log(`[Tree-sitter] Parsing ${content.length} chars...`);

        // 🟢 Incremental parse (fast!)
        const newTree = parserRef.current.parse(content, tree);
        setTree(newTree);
        console.log("[useTreeSitter] Tree updated:", newTree);
        
        lastContentRef.current = content;

        // 🟢 Extract errors
        // const foundErrors = findSyntaxErrors(newTree, content);
        // setErrors(foundErrors);
        // console.log(
        //   `[Tree-sitter] ✅ Parsed successfully. Error length: ${foundErrors.length}`,
        // );
        // console.log(
        //   `[Tree-sitter] ✅ Parsed successfully. Error length: ${foundErrors.length} and errors are ${foundErrors.map((e) => e.message).join(", ")}`,
        // );
      } catch (err) {
        console.error("[Tree-sitter] Parse error:", err);
      }
    };

    // Debounce parsing to avoid CPU churn
    const timeout = setTimeout(parseCode, 2000);
    return () => clearTimeout(timeout);
  }, [content, tree, loading]);

  return { tree, errors, loading };
}

// 🟢 Find syntax errors in AST
function findSyntaxErrors(tree, content) {
  const errors = [];

  function traverse(node) {
    // Find ERROR nodes
    if (node.type === "ERROR" || node.isMissing) {
      const { startPosition, endPosition } = node;

      errors.push({
        type: "syntax_error",
        message: `Unexpected token: "${content.substring(node.startIndex, node.endIndex).substring(0, 20)}"`,
        line: startPosition.row,
        column: startPosition.column,
        endLine: endPosition.row,
        endColumn: endPosition.column,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }

    // Check for unclosed strings/brackets
    if (node.type === "string" || node.type === "template_string") {
      const text = content.substring(node.startIndex, node.endIndex);
      const quote = text[0];

      if (!text.endsWith(quote) || text.length < 2) {
        errors.push({
          type: "unclosed_string",
          message: "Unclosed string literal",
          line: node.startPosition.row,
          column: node.startPosition.column,
          endLine: node.endPosition.row,
          endColumn: node.endPosition.column,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
    }

    // Recursively traverse children
    for (let child of node.children || []) {
      traverse(child);
    }
  }

  if (tree) {
    traverse(tree.rootNode);
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
