// hooks/useSmartIndent.js

import { useCallback } from "react";

const TAB_SIZE = 2; // 2 spaces per indent level

export function useSmartIndent(tree, content) {
  // 🟢 Calculate indent on Enter key

  const getSmartIndent = useCallback(
    (cursorIndex) => {
      if (!tree) return "";
      console.log("Seeing the content",tree ,content);
      
      // Find cursor's position in content
      const beforeCursor = content.substring(0, cursorIndex);
      const lines = beforeCursor.split("\n");
      const currentLine = lines[lines.length - 1];
      console.log("[SmartIndentHook] Current line before cursor:", currentLine);

      // Get indent level at cursor
      const indentLevel = getIndentLevelAtCursor(tree, cursorIndex);
      const baseIndent = " ".repeat(indentLevel * TAB_SIZE);
      console.log("[SmartIndentHook] this is the indent level foe your enter ",indentLevel);
      
      // Check if we're opening a block (need extra indent)
      // const trimmed = currentLine.trim();
      // if (
      //   trimmed.endsWith("{") ||
      //   trimmed.endsWith("[") ||
      //   trimmed.endsWith("(")
      // ) {
      //   return baseIndent + " ".repeat(TAB_SIZE);
      // }

      return baseIndent;
    },
    [tree, content],
  );

  // 🟢 Handle Tab key for indentation
  const insertTab = useCallback((cursorIndex, isShiftTab = false) => {
    const indentStr = " ".repeat(isShiftTab ? -TAB_SIZE : TAB_SIZE);
    return indentStr;
  }, []);

  return { getSmartIndent, insertTab };
}

function getIndentLevelAtCursor(tree, cursorIndex) {
  let depth = 0;
  let node = tree.rootNode;

  function traverse(n) {
    if (n.startIndex < cursorIndex && cursorIndex <= n.endIndex) {
      
      // Sirf wahi nodes jo actual "Visual Block" banate hain
      const blockLikeNodes = [
        "statement_block", "compound_statement", "block",
        "class_body", "switch_body", "object", "array", 
        "list_literal", "dictionary"
      ];

      // 🟢 Logic: Hum sirf tabhi depth badhayenge jab hum block ke START ke baad hon
      // Isse 'try {' ke turant baad Enter maarne par sahi position milegi.
      if (blockLikeNodes.includes(n.type)) {
        depth++;
      }

      for (let i = 0; i < n.childCount; i++) {
        traverse(n.child(i));
      }
    }
  }

  traverse(node);
  return depth;
}

const indentTypes = [
  // Blocks (JS, Java, C++)
  "statement_block",
  "compound_statement",
  "block",
  // Functions & Classes
  "function_definition",
  "method_declaration",
  "class_definition",
  "class_body",
  // Control Flow
  "if_statement",
  "for_statement",
  "while_statement",
  "do_statement",
  "switch_statement",
  // Data Structures (Agar Enter mara toh indent hona chahiye)
  "object",
  "dictionary",
  "array",
  "list_literal",
  "parenthesized_expression",
  // Java/C++ specific
  "constructor_declaration",
  "finally_clause",
];
