import { useEffect, useRef, useState } from "react";
import TreeSitterManager from "./TreeSitterManager";

export function useTreeSitter(content, language = "javascript",editData=null) {
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
        const parser = await TreeSitterManager.getParser();
        const lang = await TreeSitterManager.loadLanguage(language);

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
  }, [language]);

  // 🟢 Phase 2: Live Parsing (Incremental Soon)
  // useTreeSitter.js ke andar live parsing wala useEffect update karo

  useEffect(() => {
    if (loading || !parserRef.current) return;

    const currentContent = content || "";
    if (currentContent === lastContentRef.current) return;

    let newTree;

    // 🟢 AGAR HUMARE PAAS EDIT DATA HAI (Incremental Parse)
    if (tree && editData) {
      // editData editor se aayega: {startIndex, oldEndIndex, newEndIndex, ...}
      tree.edit(editData);
      newTree = parserRef.current.parse(currentContent, tree); // Purane tree ko base banakar parse karega
    } else {
      // 🟡 Initial parse ya full re-parse
      newTree = parserRef.current.parse(currentContent);
    }

    const syntaxErrors = findSyntaxErrors(newTree, currentContent);

    lastContentRef.current = currentContent;
    setTree(newTree);
    setErrors(syntaxErrors);
  }, [content, loading, editData]); // editData ek naya prop hoga

  return { tree, errors, loading };
}

// 🟢 Syntax Error Finder (Pure Function)
function findSyntaxErrors(tree, content) {
  const errors = [];
  const cursor = tree.walk();
  let reachedEnd = false;

  while (!reachedEnd) {
    const node = cursor.currentNode();
    if (node.type === "ERROR" || node.isMissing()) {
      errors.push({
        message: node.isMissing() ? `Missing: ${node.type}` : "Syntax Error",
        line: node.startPosition.row,
        column: node.startPosition.column,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }

    if (cursor.gotoFirstChild()) continue;
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
