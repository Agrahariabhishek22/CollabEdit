// hooks/useSmartIndent.js

import { useCallback } from "react";

const TAB_SIZE = 2; // 2 spaces per indent level

export function useSmartIndent(tree, content) {
  // 🟢 Calculate indent on Enter key
  const getSmartIndent = useCallback(
    (cursorIndex) => {
      if (!tree) return "";

      // Find cursor's position in content
      const beforeCursor = content.substring(0, cursorIndex);
      const lines = beforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];

      // Get indent level at cursor
      const indentLevel = getIndentLevelAtCursor(tree, cursorIndex);
      const baseIndent = " ".repeat(indentLevel * TAB_SIZE);

      // Check if we're opening a block (need extra indent)
      const trimmed = currentLine.trim();
      if (
        trimmed.endsWith("{") ||
        trimmed.endsWith("[") ||
        trimmed.endsWith("(")
      ) {
        return baseIndent + " ".repeat(TAB_SIZE);
      }

      return baseIndent;
    },
    [tree, content]
  );

  // 🟢 Handle Tab key for indentation
  const insertTab = useCallback(
    (cursorIndex, isShiftTab = false) => {
      const indentStr = " ".repeat(isShiftTab ? -TAB_SIZE : TAB_SIZE);
      return indentStr;
    },
    []
  );

  return { getSmartIndent, insertTab };
}

function getIndentLevelAtCursor(tree, cursorIndex) {
  let depth = 0;
  let node = tree.rootNode;

  function traverse(n) {
    if (n.startIndex <= cursorIndex && cursorIndex <= n.endIndex) {
      if (["block", "function_declaration", "if_statement", "for_statement", "while_statement"].includes(n.type)) {
        depth++;
      }
      for (let child of n.children || []) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return depth;
}