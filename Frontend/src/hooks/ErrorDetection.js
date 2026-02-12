// utils/errorDetection.js

import { inspectNode } from "../utils/treeDebugger";

/**
 * Complete Error Detection System
 * 
 * 3 Types of Errors:
 * 1. Hard Syntax Errors (ERROR nodes)
 * 2. Missing Tokens (isMissing() nodes)
 * 3. Structural Issues (Smart Linting)
 */

export function findSyntaxErrors(tree, content) {
  if (!tree) return [];

  const errors = [];

  // ============================================================================
  // TYPE 1 & 2: Hard Syntax Errors + Missing Tokens (Tree-based)
  // ============================================================================
  const syntaxErrors = findTreeErrors(tree, content);
  errors.push(...syntaxErrors);

  // ============================================================================
  // TYPE 3: Structural Errors (Smart Linting)
  // ============================================================================
  const structuralErrors = findStructuralErrors(tree, content);
  errors.push(...structuralErrors);

  // Sort by line number
  errors.sort((a, b) => a.line - b.line || a.column - b.column);

  return errors;
}

// ============================================================================
// FUNCTION 1: Find Hard Syntax Errors & Missing Tokens
// ============================================================================
function findTreeErrors(tree, content) {
  const errors = [];
  const cursor = tree.walk();
  let reachedEnd = false;

  while (!reachedEnd) {
    const node = cursor.currentNode();

    // ✅ TYPE 1: ERROR nodes (hard syntax)
    if (node.type === "ERROR") {
      const errorText = content
        .substring(node.startIndex, node.endIndex)
        .substring(0, 100);
        inspectNode(node)
      errors.push({
        type: "syntax_error",
        severity: "error",
        message: `Unexpected token: "${errorText}"`,
        line: node.startPosition.row,
        column: node.startPosition.column,
        endLine: node.endPosition.row,
        endColumn: node.endPosition.column,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
      });
    }

    // ✅ TYPE 2: Missing tokens (isMissing)
    if (node.isMissing()) {
      // Filter: Skip if inside comment or string
      if (!isInCommentOrString(node, tree, content)) {
        const suggestion = getMissingTokenSuggestion(node.type);

        errors.push({
          type: "missing_token",
          severity: "warning",
          message: `Missing ${suggestion}`,
          line: node.startPosition.row,
          column: node.startPosition.column,
          endLine: node.endPosition.row,
          endColumn: node.endPosition.column,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
    }

    // Walk tree
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

// ============================================================================
// FUNCTION 2: Find Structural Errors (Smart Linting)
// ============================================================================
function findStructuralErrors(tree, content) {
  const errors = [];

  // ✅ 1. Find duplicate object keys
  const duplicateErrors = findDuplicateKeys(tree, content);
  errors.push(...duplicateErrors);

  // ✅ 2. Find empty blocks
  const emptyBlockErrors = findEmptyBlocks(tree, content);
  errors.push(...emptyBlockErrors);

  // ✅ 3. Find unreachable code
  const unreachableErrors = findUnreachableCode(tree, content);
  errors.push(...unreachableErrors);

  return errors;
}

// ============================================================================
// LINTER 1: Duplicate Object Keys
// ============================================================================
function findDuplicateKeys(tree, content) {
  const errors = [];
  const cursor = tree.walk();
  let reachedEnd = false;

  while (!reachedEnd) {
    const node = cursor.currentNode();

    // Find object nodes
    if (node.type === "object" || node.type === "object_pattern") {
      const keyMap = new Map(); // key -> [nodes]

      // Scan all properties in this object
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);

        // Find property keys
        if (
          child.type === "pair" ||
          child.type === "shorthand_property_identifier"
        ) {
          const keyNode = getPropertyKey(child);
          if (keyNode) {
            const keyText = content
              .substring(keyNode.startIndex, keyNode.endIndex)
              .trim();

            if (!keyMap.has(keyText)) {
              keyMap.set(keyText, []);
            }
            keyMap.get(keyText).push(keyNode);
          }
        }
      }

      // Report duplicates
      keyMap.forEach((nodes, keyText) => {
        if (nodes.length > 1) {
          // Report from second occurrence onwards
          for (let i = 1; i < nodes.length; i++) {
            const dupNode = nodes[i];
            errors.push({
              type: "duplicate_key",
              severity: "warning",
              message: `Duplicate object key: "${keyText}"`,
              line: dupNode.startPosition.row,
              column: dupNode.startPosition.column,
              endLine: dupNode.endPosition.row,
              endColumn: dupNode.endPosition.column,
              startIndex: dupNode.startIndex,
              endIndex: dupNode.endIndex,
            });
          }
        }
      });
    }

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

// ============================================================================
// LINTER 2: Empty Blocks
// ============================================================================
// utils/errorDetection-LINTERS-FIXED.js

/**
 * FIXED LINTER 1: Empty Blocks Detection
 * 
 * ✅ Properly detects:
 * - Empty functions: function test() {}
 * - Empty classes: class Test {}
 * - Empty if blocks: if (true) {}
 * - Empty loops: for(;;) {}
 */

function findEmptyBlocks(tree, content) {
  const errors = [];

  if (!tree) return errors;

  const cursor = tree.walk();
  let reachedEnd = false;

  // ✅ Nodes that should NOT be empty
  const blockOwnerTypes = new Set([
    "function_declaration",
    "function_expression",
    "arrow_function",
    "method_definition",
    "class_declaration",
    "interface_declaration",
    "if_statement",
    "else_clause",
    "for_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "try_statement",
    "catch_clause",
    "finally_clause",
  ]);

  while (!reachedEnd) {
    const node = cursor.currentNode();

    // ✅ Check if this node is a block owner
    if (blockOwnerTypes.has(node.type)) {
      // ✅ FIX: Get the actual body/block child
      let blockChild = null;

      // Strategy 1: Find first child with type "block" or "statement_block"
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (
          child.type === "block" ||
          child.type === "statement_block" ||
          child.type === "compound_statement"
        ) {
          blockChild = child;
          break;
        }
      }

      // If no block found, sometimes the body IS the block
      if (!blockChild) {
        blockChild = node;
      }

      // ✅ FIX: Check if body is empty using namedChildCount
      // namedChildCount = real statements (ignores { })
      if (blockChild && blockChild.namedChildCount === 0) {
        // Get a readable name for this block
        const blockName = getBlockName(node, content);

        console.log(
          `[EmptyBlock] Found at line ${node.startPosition.row}: ${node.type} (${blockName})`
        );

        errors.push({
          type: "empty_block",
          severity: "info",
          message: `Empty ${blockName} - add logic or remove`,
          line: node.startPosition.row,
          column: node.startPosition.column,
          endLine: node.endPosition.row,
          endColumn: node.endPosition.column,
          startIndex: node.startIndex,
          endIndex: node.endIndex,
        });
      }
    }

    // Tree traversal
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

/**
 * Helper: Get readable block name
 */
function getBlockName(node, content) {
  const typeMap = {
    "function_declaration": "function",
    "function_expression": "function",
    "arrow_function": "arrow function",
    "method_definition": "method",
    "class_declaration": "class",
    "interface_declaration": "interface",
    "if_statement": "if block",
    "else_clause": "else block",
    "for_statement": "for loop",
    "while_statement": "while loop",
    "do_statement": "do-while loop",
    "switch_statement": "switch statement",
    "try_statement": "try block",
    "catch_clause": "catch block",
    "finally_clause": "finally block",
  };

  const name = typeMap[node.type] || "block";

  // Try to extract function/class name
  if (
    (node.type === "function_declaration" ||
      node.type === "class_declaration" ||
      node.type === "method_definition") &&
    node.childCount > 0
  ) {
    // Second child is usually the name
    for (let i = 0; i < Math.min(3, node.childCount); i++) {
      const child = node.child(i);
      if (child.type === "identifier") {
        const identName = content.substring(child.startIndex, child.endIndex);
        return `${name} "${identName}"`;
      }
    }
  }

  return name;
}

/**
 * FIXED LINTER 3: Unreachable Code Detection
 * 
 * ✅ Properly detects:
 * - Code after return
 * - Code after break/continue
 * - Code after throw
 */
function findUnreachableCode(tree, content) {
  const errors = [];

  if (!tree) return errors;

  const cursor = tree.walk();
  let reachedEnd = false;

  // ✅ Statements that make following code unreachable
  const blockingStatements = new Set([
    "return_statement",
    "break_statement",
    "continue_statement",
    "throw_statement",
  ]);

  while (!reachedEnd) {
    const node = cursor.currentNode();

    // ✅ Check if this is a blocking statement
    if (blockingStatements.has(node.type)) {
      const parent = node.parent;

      // ✅ Only check if parent is actual statement block
      if (parent && isStatementBlockType(parent.type)) {
        console.log(
          `[Unreachable] Found ${node.type} at line ${node.startPosition.row}`
        );

        // ✅ FIX: Better sibling detection
        // Get all named children (actual statements, ignore symbols)
        const namedChildren = [];
        for (let i = 0; i < parent.namedChildCount; i++) {
          namedChildren.push(parent.namedChild(i));
        }

        // Find current node in named children
        const currentIndex = namedChildren.findIndex((child) => {
          return (
            child.startIndex === node.startIndex &&
            child.endIndex === node.endIndex
          );
        });

        if (currentIndex !== -1) {
          // Check all statements AFTER current one
          for (let i = currentIndex + 1; i < namedChildren.length; i++) {
            const unreachable = namedChildren[i];

            // ✅ Skip comments and empty statements
            if (isRealStatement(unreachable, content)) {
              const statementType = getStatementType(unreachable.type);

              console.log(
                `[Unreachable] Code after ${node.type} at line ${unreachable.startPosition.row}`
              );
            //   inspectNode(node)

              errors.push({
                type: "unreachable_code",
                severity: "warning",
                message: `${statementType} after ${getStatementType(node.type)} - unreachable`,
                line: unreachable.startPosition.row,
                column: unreachable.startPosition.column,
                endLine: unreachable.endPosition.row,
                endColumn: unreachable.endPosition.column,
                startIndex: unreachable.startIndex,
                endIndex: unreachable.endIndex,
              });
            }
          }
        }
      }
    }

    // Tree traversal
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

/**
 * Helper: Check if parent is statement block
 */
function isStatementBlockType(type) {
  return new Set([
    "block",
    "statement_block",
    "compound_statement",
    "program",
    "class_body",
    "interface_body",
  ]).has(type);
}

/**
 * Helper: Check if node is a real statement (not comment/empty)
 */
function isRealStatement(node, content) {
  // Skip comments
  if (node.type === "comment" || node.type.includes("comment")) {
    return false;
  }

  // Skip empty statements
  if (node.type === "empty_statement") {
    return false;
  }

  // Check if it's just whitespace
  const text = content.substring(node.startIndex, node.endIndex).trim();
  if (text.length === 0) {
    return false;
  }

  return true;
}

/**
 * Helper: Get human readable statement type
 */
function getStatementType(type) {
  const typeMap = {
    "return_statement": "return",
    "break_statement": "break",
    "continue_statement": "continue",
    "throw_statement": "throw",
    "expression_statement": "expression",
    "variable_declaration": "variable declaration",
    "function_declaration": "function declaration",
    "class_declaration": "class declaration",
    "if_statement": "if statement",
    "for_statement": "for loop",
    "while_statement": "while loop",
  };

  return typeMap[type] || type;
}

/**
 * Export all functions
 */
// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the key node from a property pair
 */
function getPropertyKey(pairNode) {
  for (let i = 0; i < pairNode.childCount; i++) {
    const child = pairNode.child(i);
    if (
      child.type === "property_identifier" ||
      child.type === "string" ||
      child.type === "number"
    ) {
      return child;
    }
  }
  return null;
}

/**
 * Check if node is inside comment or string
 */
function isInCommentOrString(node, tree, content) {
  let current = node.parent;

  while (current) {
    if (
      current.type === "comment" ||
      current.type === "string" ||
      current.type === "template_string" ||
      current.type.includes("string")
    ) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

/**
 * Get suggestion text for missing token
 */
function getMissingTokenSuggestion(nodeType) {
  const suggestions = {
    ";": "semicolon",
    ",": "comma",
    "}": "closing brace",
    "]": "closing bracket",
    ")": "closing parenthesis",
    ":": "colon",
    "=>": "arrow function syntax",
  };

  return suggestions[nodeType] || nodeType;
}
