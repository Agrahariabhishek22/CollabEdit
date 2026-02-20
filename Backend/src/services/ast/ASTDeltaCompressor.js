// src/services/ast/ASTDeltaCompressor.js

/**
 * ASTDeltaCompressor
 *
 * Computes differences between old and new AST.
 * Sends only CHANGES to frontend (not full tree).
 *
 * DELTA FORMAT:
 * {
 *   changes: [
 *     { operation: "add", nodeId, nodePath, newValue },
 *     { operation: "modify", nodeId, nodePath, oldValue, newValue },
 *     { operation: "remove", nodeId, nodePath }
 *   ],
 *   checksum: "sha256_hash",
 *   timestamp: Date.now()
 * }
 *
 * USAGE:
 * const delta = compressor.computeDelta(oldAST, newAST);
 * // Returns minimal diff for network transmission
 */
class ASTDeltaCompressor {
  constructor() {
    this.previousAST = new Map(); // fileId → lastAST
  }

  /**
   * Compute delta between old and new AST
   */
  computeDelta(fileId, newAST) {
    try {
      const oldAST = this.previousAST.get(fileId);
      const changes = [];

      if (!oldAST) {
        // First time: treat all as additions
        this._collectNodes(newAST, null, changes, "add");
      } else {
        // Compare old vs new
        changes.push(...this._diffAST(oldAST, newAST));
      }

      // Update cache
      this.previousAST.set(fileId, this._cloneAST(newAST));

      // Create delta
      const delta = {
        changes: changes.slice(0, 100), // Limit to 100 changes per delta
        checksum: this._hashAST(newAST),
        timestamp: Date.now(),
      };

      return delta;
    } catch (err) {
      console.error("[ASTDeltaCompressor] Compute delta error:", err);
      return { changes: [], checksum: "", timestamp: Date.now() };
    }
  }

  /**
   * Diff two ASTs
   */
  _diffAST(oldAST, newAST) {
    const changes = [];

    // Compare top-level declarations
    const oldDecls = this._extractDeclarations(oldAST);
    const newDecls = this._extractDeclarations(newAST);

    // Find removed declarations
    for (const [name, oldNode] of Object.entries(oldDecls)) {
      if (!newDecls[name]) {
        changes.push({
          operation: "remove",
          nodeId: oldNode.id || name,
          nodePath: `program > ${oldNode.type}[${name}]`,
          oldValue: oldNode,
        });
      }
    }

    // Find added/modified declarations
    for (const [name, newNode] of Object.entries(newDecls)) {
      const oldNode = oldDecls[name];

      if (!oldNode) {
        // New declaration
        changes.push({
          operation: "add",
          nodeId: newNode.id || name,
          nodePath: `program > ${newNode.type}[${name}]`,
          newValue: {
            name: newNode.name,
            type: newNode.type,
            line: newNode.loc?.start?.line,
            params: newNode.params?.map((p) => p.name),
          },
        });
      } else if (!this._nodesEqual(oldNode, newNode)) {
        // Modified declaration
        changes.push({
          operation: "modify",
          nodeId: newNode.id || name,
          nodePath: `program > ${newNode.type}[${name}]`,
          oldValue: {
            line: oldNode.loc?.start?.line,
            params: oldNode.params?.map((p) => p.name),
          },
          newValue: {
            line: newNode.loc?.start?.line,
            params: newNode.params?.map((p) => p.name),
          },
        });
      }
    }

    return changes;
  }

  /**
   * Extract all declarations from AST
   */
  _extractDeclarations(ast) {
    const decls = {};

    if (!ast || !ast.body) return decls;

    for (const node of ast.body) {
      let name = null;

      if (node.type === "VariableDeclaration") {
        // const/let x = ...
        for (const decl of node.declarations || []) {
          name = decl.id?.name;
          if (name) {
            decls[name] = { ...node, name, type: "VariableDeclaration" };
          }
        }
      } else if (node.type === "FunctionDeclaration") {
        name = node.name;
        if (name) {
          decls[name] = { ...node, name, type: "FunctionDeclaration" };
        }
      } else if (node.type === "ClassDeclaration") {
        name = node.id?.name;
        if (name) {
          decls[name] = { ...node, name, type: "ClassDeclaration" };
        }
      } else if (node.type === "ExportNamedDeclaration" && node.declaration) {
        // export { x } or export function foo() {}
        const decl = node.declaration;
        if (decl.type === "VariableDeclaration") {
          for (const d of decl.declarations || []) {
            name = d.id?.name;
            if (name) {
              decls[name] = {
                ...decl,
                name,
                type: "ExportNamedDeclaration",
              };
            }
          }
        } else if (decl.type === "FunctionDeclaration") {
          name = decl.name;
          if (name) {
            decls[name] = { ...decl, name, type: "ExportNamedDeclaration" };
          }
        }
      }
    }

    return decls;
  }

  /**
   * Collect all nodes (for initial delta)
   */
  _collectNodes(node, parentPath, changes, operation) {
    if (!node) return;

    if (node.type && node.name) {
      changes.push({
        operation,
        nodeId: node.name,
        nodePath: `${parentPath || "root"} > ${node.type}[${node.name}]`,
        newValue: {
          name: node.name,
          type: node.type,
          line: node.loc?.start?.line,
        },
      });
    }

    // Recurse into children
    if (Array.isArray(node.body)) {
      for (const child of node.body) {
        this._collectNodes(
          child,
          `${parentPath || "root"} > ${node.type || ""}`,
          changes,
          operation
        );
      }
    }
  }

  /**
   * Check if two nodes are equal
   */
  _nodesEqual(node1, node2) {
    if (!node1 || !node2) return node1 === node2;

    // Compare key properties
    return (
      node1.type === node2.type &&
      node1.name === node2.name &&
      JSON.stringify(node1.params) === JSON.stringify(node2.params)
    );
  }

  /**
   * Clone AST for cache
   */
  _cloneAST(ast) {
    return JSON.parse(JSON.stringify(ast));
  }

  /**
   * Hash AST
   */
  _hashAST(ast) {
    const crypto = require("crypto");
    const astString = JSON.stringify(ast);
    return crypto.createHash("sha256").update(astString).digest("hex");
  }
}

export default ASTDeltaCompressor;