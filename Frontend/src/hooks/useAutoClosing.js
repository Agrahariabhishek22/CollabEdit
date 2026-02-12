// hooks/useAutoClosing.js

import { useCallback } from "react";
import { debugTree } from "../utils/treeDebugger";

/**
 * Auto-Closing Pairs Hook
 * 
 * Features:
 * - Auto-close brackets: () [] {} 
 * - Auto-close quotes: "" ''
 * - Smart: Doesn't close if already closed
 * - Context-aware: Doesn't close inside strings/comments
 * - Proper indentation: Closing bracket gets parent indent
 */

const CLOSING_PAIRS = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

const OPENING_CHARS = Object.keys(CLOSING_PAIRS);

export function useAutoClosing(tree, content) {
    // debugTree(tree,content)
  // ============================================================================
  // Main function: Handle auto-closing on character insertion
  // ============================================================================
  const handleAutoClosing = useCallback(
    (char, cursorIndex, cursorLine, cursorColumn) => {
      // ✅ Only handle opening characters
      if (!OPENING_CHARS.includes(char)) {
        return null; // No auto-closing needed
      }

      // ✅ Check context: Are we inside string/comment?
      if (isInStringOrComment(tree, cursorIndex)) {
        console.log(`[AutoClose] Inside string/comment, skipping`);
        return null;
      }

      // ✅ Check if closing pair already exists nearby
      const closingChar = CLOSING_PAIRS[char];
      const nextChar = content[cursorIndex] || "";

      // If next char is already the closing pair, don't add it
      if (nextChar === closingChar) {
        console.log(`[AutoClose] Closing pair already exists, skipping`);
        return null;
      }

      // ✅ For brackets, check if we should add newline + proper indent
      const isBracket = ["{", "[", "("].includes(char);

      if (isBracket) {
        // ✅ Strategy: Check if user wants to add newline
        // This will be handled by onEnter in InputLayer
        return {
          type: "auto_close",
          char,
          closingChar,
          cursorIndex,
          shouldAddNewline: false, // Will be set by InputLayer if needed
        };
      } else {
        // Quotes: just add closing quote
        return {
          type: "auto_close",
          char,
          closingChar,
          cursorIndex,
          shouldAddNewline: false,
        };
      }
    },
    [tree, content]
  );

  // ============================================================================
  // Insert auto-closing pair
  // ============================================================================
  const insertAutoClosingPair = useCallback(
    (char, closingChar, cursorIndex, shouldAddNewline = false) => {
      if (shouldAddNewline) {
        // ✅ For brackets with newline:
        // User typed: "{"
        // Result:
        // {
        //   |cursor here with proper indent
        // }

        const parentIndent = getParentIndentation(tree, content, cursorIndex);
        const innerIndent = parentIndent + "  "; // Add 2 spaces
        

        return [
          {
            type: "insert",
            index: cursorIndex,
            text: "\n" + innerIndent,
          },
          {
            type: "insert",
            index: cursorIndex + innerIndent.length + 1,  // After inserted text
            text: "\n" + parentIndent + closingChar,
          },
        ];
      } else {
        // ✅ For simple closing (quotes or single-line brackets):
        return [
          {
            type: "insert",
            index: cursorIndex,
            text: closingChar,
          },
        ];
      }
    },
    [tree, content]
  );

  return {
    handleAutoClosing,
    insertAutoClosingPair,
  };
}

// ============================================================================
// HELPER 1: Check if inside string or comment
// ============================================================================
function isInStringOrComment(tree, cursorIndex) {
  if (!tree) return false;

  try {
    const node = tree.rootNode.descendantForIndex(cursorIndex, cursorIndex);

    if (!node) return false;

    // ✅ Check current node and parents
    let current = node;
    while (current) {
      if (
        current.type === "string" ||
        current.type === "template_string" ||
        current.type === "comment" ||
        current.type.includes("string") ||
        current.type.includes("comment")
      ) {
        console.log(
          `[AutoClose] Detected ${current.type} at cursor, skipping auto-close`
        );
        return true;
      }
      current = current.parent;
    }

    return false;
  } catch (err) {
    console.warn("[AutoClose] Error checking context:", err);
    return false;
  }
}

// ============================================================================
// HELPER 2: Get parent indentation level
// ============================================================================
function getParentIndentation(tree, content, cursorIndex) {
  if (!tree) return "";

  try {
    // ✅ Find node at cursor
    const node = tree.rootNode.descendantForIndex(cursorIndex, cursorIndex);

    if (!node) return "";

    // ✅ Walk up to find containing block
    let current = node;
    let blockDepth = 0;

    const blockTypes = new Set([
      "block",
      "statement_block",
      "compound_statement",
      "class_body",
      "object",
      "array",
    ]);

    while (current) {
      if (blockTypes.has(current.type)) {
        blockDepth++;
      }
      current = current.parent;
    }

    // ✅ Return indentation string
    // Parent block is at (blockDepth - 1) levels
    const indentLevel = Math.max(0, blockDepth - 1);
    return " ".repeat(indentLevel * 2); // 2 spaces per indent
  } catch (err) {
    console.warn("[AutoClose] Error getting parent indent:", err);
    return "";
  }
}

// ============================================================================
// HELPER 3: Check if closing pair already exists
// ============================================================================
export function getNextNonWhitespaceChar(content, cursorIndex) {
  let i = cursorIndex;
  while (i < content.length) {
    const char = content[i];
    if (char !== " " && char !== "\t" && char !== "\n") {
      return char;
    }
    i++;
  }
  return "";
}

// ============================================================================
// HELPER 4: Skip auto-close if pair exists
// ============================================================================
export function shouldSkipAutoClose(content, cursorIndex, closingChar) {
  const nextChar = getNextNonWhitespaceChar(content, cursorIndex);
  return nextChar === closingChar;
}