// hooks/useSmartIndent.js - FIXED VERSION

import { useCallback } from "react";

const TAB_SIZE = 2; // 2 spaces per indent level

/**
 * Smart Indentation Hook
 *
 * Features:
 * - Detects if cursor is inside block (class, function, if, etc)
 * - Returns proper indent level for Enter key
 * - Handles nested blocks correctly
 * - Works across all languages
 */
export function useSmartIndent(tree, content) {
  // ============================================================================
  // Main function: Get proper indent for current line
  // ============================================================================
  const getSmartIndent = useCallback(
    (cursorIndex) => {
      if (!tree || cursorIndex === undefined) {
        return ""; // No indent if no tree or invalid cursor
      }

      // ✅ FIX 1: Validate cursor index
      const validCursorIndex = Math.max(
        0,
        Math.min(cursorIndex, content.length - 1),
      );

      console.log(
        `[SmartIndent] Cursor at ${validCursorIndex}, Content length: ${content.length}`,
      );

      // ✅ FIX 2: Get the node at cursor position
      const nodeAtCursor = tree.rootNode.descendantForIndex(
        validCursorIndex,
        validCursorIndex,
      );

      if (!nodeAtCursor) {
        console.warn("[SmartIndent] No node found at cursor");
        return "";
      }

      console.log(
        `[SmartIndent] Node at cursor: ${nodeAtCursor.type} (${nodeAtCursor.startIndex}-${nodeAtCursor.endIndex})`,
      );
      console.log(nodeAtCursor);

      // ✅ FIX 3: Walk up the tree to find block context
      const indentLevel = calculateIndentLevel(nodeAtCursor);

      console.log(`[SmartIndent] Calculated indent level: ${indentLevel}`);

      // ✅ FIX 4: Check if we need EXTRA indent (opening block)
      const extraIndent = shouldAddExtraIndent(
        nodeAtCursor,
        validCursorIndex,
        content,
      );

      const totalIndent = indentLevel + (extraIndent ? 1 : 0);
      const indentStr = " ".repeat(totalIndent * TAB_SIZE);

      console.log(
        `[SmartIndent] Total indent: ${totalIndent} levels = "${indentStr}"`,
      );

      return indentStr;
    },
    [tree, content],
  );

  // ============================================================================
  // Handle Tab key for manual indentation
  // ============================================================================
  const insertTab = useCallback((cursorIndex, isShiftTab = false) => {
    const indentStr = " ".repeat(isShiftTab ? -TAB_SIZE : TAB_SIZE);
    return indentStr;
  }, []);

  return { getSmartIndent, insertTab };
}

// ============================================================================
// HELPER 1: Calculate indent level by walking up tree
// ============================================================================
/**
 * Walk up from current node and count block levels
 * Each block (class, function, if, etc) adds 1 indent level
 */
function calculateIndentLevel(node) {
  let indentLevel = 0;
  let currentNode = node;
  // console.log(node.text);

  // ✅ FIX: Walk up the tree, not down
  while (currentNode) {
    const isBlockNode = isBlockLikeNode(currentNode.type);

    console.log(
      `[CalcIndent] Checking: ${currentNode.type}, isBlock: ${isBlockNode}`,
    );

    if (isBlockNode) {
      indentLevel++;
    }

    currentNode = currentNode.parent;
  }

  return indentLevel;
}

// ============================================================================
// HELPER 2: Check if node is a block-like node
// ============================================================================
function isBlockLikeNode(nodeType) {
  const blockNodes = new Set([
    // ==========================================
    // 1. PURE CONTAINERS (Structural Blocks)
    // ==========================================
    "statement_block", // JS, C++, Java, Go
    "compound_statement", // C, C++, Python
    "class_body", // JS, Java, C++
    "interface_body", // TS, Java
    "object", // JS Object literals
    "array", // JS/Go Arrays
    "list_literal", // Python Lists
    "dictionary", // Python Dicts
    "switch_statement", // Sab languages ke liye
    "case_clause", // Indent inside cases
    "catch_clause",
    "finally_clause",

    // ==========================================
    // 2. LANGUAGE SPECIFIC WRAPPERS (Careful here!)
    // ==========================================
    // Note: JS mein 'arrow_function' ko hata diya hai kyunki
    // uske andar 'statement_block' count ho jayega.

    // "function_definition", // Python (Python has no { }, so this is the block)
    // "if_statement", // Python (Indentation based)
    // "for_statement", // Python
    // "while_statement", // Python
    // "try_statement", // Python

    // "program" aur "arrow_function" ko list se nikaal diya hai
    // taaki "Double Counting" na ho.
  ]);

  return blockNodes.has(nodeType);
}
// ============================================================================
// HELPER 3: Check if we should add EXTRA indent
// ============================================================================
/**
 * Determines if we should add extra indent
 *
 * Cases where we add extra indent:
 * 1. Cursor is right after opening brace/bracket/paren: { [ (
 * 2. Line ends with opening character
 * 3. Inside empty block

 * Get the indentation of the current line
 * Useful for matching indentation when no block is involved
 */

function shouldAddExtraIndent(node, cursorIndex, content) {
  if (cursorIndex === 0) return false;

  const beforeCursor = content.substring(0, cursorIndex);
  const trimmedBefore = beforeCursor.trimEnd();

  // 1. Language Agnostic Opening Brackets
  const openingChars = ["{", "[", "("];

  // 2. Python Specific: Check for colon (:) at the end of line
  // Robust check: ensure it's not a ternary or object property
  const isPythonStyleBlock = trimmedBefore.endsWith(":");

  if (
    openingChars.some((char) => trimmedBefore.endsWith(char)) ||
    isPythonStyleBlock
  ) {
    // --- CRITICAL FIX FOR DOUBLE COUNTING ---
    // Agar AST ne pehle hi is block ko detect kar liya hai,
    // toh manual indent skip karna chahiye.

    const nodeType = node?.type || "";
    const redundantNodes = [
      "statement_block",
      "object",
      "array",
      "compound_statement",
    ];

    if (redundantNodes.includes(nodeType)) {
      console.log(
        `[ExtraIndent] Skipping manual indent: AST node '${nodeType}' already handled it.`,
      );
      return false;
    }

    console.log(
      "[ExtraIndent] Adding indent based on trailing char:",
      trimmedBefore.slice(-1),
    );
    return true;
  }

  return false;
}
// ============================================================================
// DEBUG: Log node hierarchy
// ============================================================================
export function debugNodeHierarchy(node, depth = 0) {
  const indent = "  ".repeat(depth);
  console.log(`${indent}${node.type} (${node.startIndex}-${node.endIndex})`);

  for (let i = 0; i < node.childCount; i++) {
    debugNodeHierarchy(node.child(i), depth + 1);
  }
}
