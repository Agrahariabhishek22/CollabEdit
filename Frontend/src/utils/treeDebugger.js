// utils/treeDebugger.js

/**
 * Tree-Sitter Tree Debugger
 * 
 * Prints complete tree structure for debugging
 * Output format:
 * node_type [startRow, startCol] - [endRow, endCol]
 *   child_node [startRow, startCol] - [endRow, endCol]
 *     grandchild...
 */

export function debugTree(tree, content = "", maxDepth = Infinity, startNode = null) {
  if (!tree) {
    console.log("❌ Tree is null or undefined");
    return;
  }

  console.log("🌳 ===== TREE STRUCTURE =====");

  const rootNode = startNode || tree.rootNode;
  const output = [];

  function traverse(node, depth = 0, output = []) {
    if (depth > maxDepth) return;

    const indent = "  ".repeat(depth);
    const start = `[${node.startPosition.row}, ${node.startPosition.column}]`;
    const end = `[${node.endPosition.row}, ${node.endPosition.column}]`;

    // ✅ Build node info
    let nodeInfo = `${indent}${node.type} ${start} - ${end}`;

    // ✅ Add extra info for named children
    if (node.childCount > 0 && node.namedChildCount === 0) {
      // Leaf node - show content
      const nodeContent = content
        .substring(node.startIndex, node.endIndex)
        .replace(/\n/g, "\\n")
        .substring(0, 50);

      if (nodeContent) {
        nodeInfo += ` "${nodeContent}"`;
      }
    }

    output.push(nodeInfo);

    // ✅ Only traverse named children (important!)
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      traverse(child, depth + 1, output);
    }
  }

  traverse(rootNode, 0, output);

  // Print all at once
  output.forEach(line => console.log(line));

  console.log("🌳 ===== END TREE =====\n");

  return output;
}

/**
 * Detailed Tree Inspector
 * Shows more info: type, children count, missing flag, etc
 */
export function inspectNode(node, content = "") {
  if (!node) {
    console.log("❌ Node is null");
    return;
  }

  const nodeContent = content.substring(node.startIndex, node.endIndex);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    NODE INSPECTION                         ║
╚════════════════════════════════════════════════════════════╝

📍 Position:
   Type:                 ${node.type}
   Start:                ${node.startPosition.row}:${node.startPosition.column}
   End:                  ${node.endPosition.row}:${node.endPosition.column}
   Index Range:          ${node.startIndex} - ${node.endIndex}

👶 Children:
   Total Children:       ${node.childCount}
   Named Children:       ${node.namedChildCount}
   Has Error:            ${node.hasError ? "❌ YES" : "✅ NO"}
   Is Missing:           ${node.isMissing() ? "❌ YES" : "✅ NO"}
   
📝 Content:
   "${nodeContent.substring(0, 100)}${nodeContent.length > 100 ? "..." : ""}"

🔗 Parent:
   ${node.parent ? node.parent.type : "NONE (ROOT)"}

👶 Named Children:
  `);

  for (let i = 0; i < Math.min(5, node.namedChildCount); i++) {
    const child = node.namedChild(i);
    console.log(
      `   ${i + 1}. ${child.type} [${child.startPosition.row}, ${child.startPosition.column}]`
    );
  }

  if (node.namedChildCount > 5) {
    console.log(`   ... and ${node.namedChildCount - 5} more`);
  }

  console.log("\n");
}

/**
 * Find and highlight errors in tree
 */
export function findTreeErrors(tree, content = "") {
  const errors = [];
  const cursor = tree.walk();
  let reachedEnd = false;

  console.log("🔍 ===== SEARCHING FOR ERRORS =====");

  while (!reachedEnd) {
    const node = cursor.currentNode();

    if (node.type === "ERROR" || node.isMissing()) {
      const errorContent = content.substring(node.startIndex, node.endIndex);

      errors.push({
        type: node.type === "ERROR" ? "❌ ERROR NODE" : "⚠️  MISSING TOKEN",
        nodeType: node.type,
        position: `${node.startPosition.row}:${node.startPosition.column}`,
        content: errorContent.substring(0, 40),
        parent: node.parent ? node.parent.type : "NONE",
      });

      console.log(
        `${node.type === "ERROR" ? "❌" : "⚠️ "} ${node.type} at ${node.startPosition.row}:${node.startPosition.column}`
      );
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

  console.log(`\n🔍 Found ${errors.length} errors\n`);

  return errors;
}

/**
 * Get node at specific cursor position
 */
export function getNodeAtCursor(tree, cursorIndex) {
  if (!tree) {
    console.log("❌ Tree is null");
    return null;
  }

  try {
    const node = tree.rootNode.descendantForIndex(cursorIndex, cursorIndex);

    if (!node) {
      console.log(`❌ No node found at index ${cursorIndex}`);
      return null;
    }

    console.log(`✅ Found node at cursor ${cursorIndex}:`);
    inspectNode(node);

    return node;
  } catch (err) {
    console.error(`❌ Error getting node at ${cursorIndex}:`, err);
    return null;
  }
}

/**
 * Show node hierarchy from cursor to root
 */
export function showNodePath(tree, cursorIndex) {
  const node = getNodeAtCursor(tree, cursorIndex);

  if (!node) return;

  console.log(`📍 ===== NODE PATH FROM CURSOR TO ROOT =====`);

  let current = node;
  let depth = 0;

  while (current) {
    const indent = "  ".repeat(depth);
    console.log(
      `${indent}${depth === 0 ? "→ (cursor)" : "↑"} ${current.type} [${current.startPosition.row}, ${current.startPosition.column}]`
    );
    current = current.parent;
    depth++;
  }

  console.log(`📍 ===== END PATH =====\n`);
}

/**
 * Compare two trees (for testing)
 */
export function compareNodes(node1, node2) {
  if (!node1 || !node2) {
    console.log("❌ One or both nodes are null");
    return false;
  }

  const match = {
    type: node1.type === node2.type,
    startRow: node1.startPosition.row === node2.startPosition.row,
    startCol: node1.startPosition.column === node2.startPosition.column,
    endRow: node1.endPosition.row === node2.endPosition.row,
    endCol: node1.endPosition.column === node2.endPosition.column,
    childCount: node1.namedChildCount === node2.namedChildCount,
  };

  const allMatch = Object.values(match).every(v => v);

  console.log(`
  Type:       ${match.type ? "✅" : "❌"} ${node1.type} vs ${node2.type}
  Start Pos:  ${match.startRow && match.startCol ? "✅" : "❌"} [${node1.startPosition.row}, ${node1.startPosition.column}] vs [${node2.startPosition.row}, ${node2.startPosition.column}]
  End Pos:    ${match.endRow && match.endCol ? "✅" : "❌"} [${node1.endPosition.row}, ${node1.endPosition.column}] vs [${node2.endPosition.row}, ${node2.endPosition.column}]
  Children:   ${match.childCount ? "✅" : "❌"} ${node1.namedChildCount} vs ${node2.namedChildCount}
  `);

  return allMatch;
}

/**
 * Export tree structure as JSON (for saving/comparing)
 */
export function treeToJSON(node, depth = 0, maxDepth = 10) {
  if (!node || depth > maxDepth) return null;

  return {
    type: node.type,
    start: {
      row: node.startPosition.row,
      column: node.startPosition.column,
    },
    end: {
      row: node.endPosition.row,
      column: node.endPosition.column,
    },
    namedChildCount: node.namedChildCount,
    children: Array.from({ length: node.namedChildCount }).map((_, i) =>
      treeToJSON(node.namedChild(i), depth + 1, maxDepth)
    ),
  };
}

/**
 * Pretty print tree in a visual way
 */
export function visualizeTree(tree, content = "", maxDepth = 6) {
  if (!tree) {
    console.log("❌ Tree is null");
    return;
  }

  console.log(`\n🎨 ===== VISUAL TREE =====\n`);

  function traverse(node, depth = 0) {
    if (depth > maxDepth) return;

    const indent = "│ ".repeat(depth);
    const branch = depth === 0 ? "🌳" : "├─";

    // Color coding by node type
    const emoji = getNodeEmoji(node.type);

    console.log(`${indent}${branch} ${emoji} ${node.type}`);

    for (let i = 0; i < Math.min(3, node.namedChildCount); i++) {
      traverse(node.namedChild(i), depth + 1);
    }

    if (node.namedChildCount > 3) {
      console.log(`${indent}└─ ... +${node.namedChildCount - 3} more children`);
    }
  }

  traverse(tree.rootNode, 0);
  console.log(`\n🎨 ===== END VISUAL TREE =====\n`);
}

/**
 * Helper: Get emoji for node type
 */
function getNodeEmoji(type) {
  const emojiMap = {
    "program": "📄",
    "function_declaration": "🔧",
    "function_expression": "➡️ ",
    "class_declaration": "🏛️ ",
    "if_statement": "❓",
    "for_statement": "🔁",
    "while_statement": "🔄",
    "return_statement": "↩️ ",
    "identifier": "🏷️ ",
    "string": "📝",
    "number": "🔢",
    "comment": "💬",
    "block": "📦",
    "statement_block": "📦",
    "ERROR": "❌",
  };

  return emojiMap[type] || "📌";
}

/**
 * Quick diagnostic
 */
export function quickDiagnostic(tree, content = "") {
  if (!tree) {
    console.log("❌ Tree is NULL - Tree-sitter not initialized!");
    return;
  }

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    TREE DIAGNOSTIC                         ║
╚════════════════════════════════════════════════════════════╝

✅ Tree Status:           VALID
📊 Root Node Type:        ${tree.rootNode.type}
📏 Total Content Length:  ${content.length} chars
📍 Root Position:         [${tree.rootNode.startPosition.row}, ${tree.rootNode.startPosition.column}] - [${tree.rootNode.endPosition.row}, ${tree.rootNode.endPosition.column}]

🔍 Error Summary:
`);

  findTreeErrors(tree, content);
}