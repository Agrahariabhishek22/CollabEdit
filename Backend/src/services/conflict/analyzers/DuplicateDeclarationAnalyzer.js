// src/services/conflict/analyzers/DuplicateDeclarationAnalyzer.js

import { log } from "console";
import BaseAnalyzer from "./BaseAnalyzer.js";

/**
 * DuplicateDeclarationAnalyzer
 *
 * Detects when two declarations have the same name in the same scope.
 *
 * EXAMPLES:
 * ✗ const x = 1; const x = 2;         → CONFLICT
 * ✗ function foo() {} function foo() {}→ CONFLICT
 * ✓ let x = 1; { let x = 2; }         → OK (different scopes)
 *
 * HANDLES BOTH AST FORMATS:
 * 1. Babel AST: { type: "Program", body: [...] }
 * 2. Tree-Sitter AST: { type: "Program", root: {...} }
 */
class DuplicateDeclarationAnalyzer extends BaseAnalyzer {
  constructor() {
    super("DuplicateDeclarationAnalyzer");
  }

  async analyze(lspContext, fileId, userId) {
    try {
      const { ast, code } = lspContext;

      if (!ast) {
        this.log("No AST available");
        return [];
      }

      // 🔴 FIX: Handle both Babel and Tree-Sitter AST formats
      const declarations = this._extractAllDeclarations(ast);

      if (declarations.length === 0) {
        this.log("No declarations found");
        return [];
      }

      // Find duplicates at global scope
      const conflicts = [];
      const duplicates = this._findDuplicatesInScope(declarations, "global");

      for (const dup of duplicates) {
        const conflict = this.createConflict({
          type: "duplicate-declaration",
          severity: "blocking",
          symbol: dup.name,
          scope: "global",
          location: {
            startLine: dup.line || 0,
            endLine: dup.line || 0,
            startColumn: 0,
            endColumn: 0,
          },
          relatedSymbols: [dup.name],
          suggestedFix: {
            type: "rename",
            suggestions: this._generateRenameSuggestions(dup.name),
          },
          metadata: {
            createdBy: userId,
            detectedBy: this.analyzerName,
          },
        });

        conflicts.push(conflict);
        this.log(
          `Found duplicate declaration: '${dup.name}' at line ${dup.line}`,
        );
      }

      return conflicts;
    } catch (err) {
      this.errorLog("Analysis failed", err);
      return [];
    }
  }

  /**
   * Extract declarations from BOTH AST formats
   *
   * Format 1 (Babel): { body: [...declarations...] }
   * Format 2 (Tree-Sitter): { root: {...tree...} }
   */
  _extractAllDeclarations(ast) {
    const declarations = [];

    // Handle Babel format (has body array)
    if (ast.body && Array.isArray(ast.body)) {
      return this._extractFromBabelAST(ast.body);
    }

    // Handle Tree-Sitter format (has root node)
    if (ast.root && typeof ast.root === "object") {
      return this._extractFromTreeSitterAST(ast.root);
    }

    // Fallback: try to extract from current node
    this.log("Unknown AST format, attempting fallback extraction");
    return this._extractFromTreeSitterAST(ast);
  }

  /**
   * Extract from Babel AST format
   */
  _extractFromBabelAST(bodyArray) {
    const declarations = [];

    for (const node of bodyArray) {
      if (node.type === "VariableDeclaration") {
        for (const decl of node.declarations || []) {
          const name = this.getSymbolName(decl);
          if (name) {
            declarations.push({
              name,
              line: (decl.loc?.start?.line || node.loc?.start?.line || 0) - 1,
              type: "variable",
            });
          }
        }
      } else if (node.type === "FunctionDeclaration") {
        const name = this.getSymbolName(node);
        if (name) {
          declarations.push({
            name,
            line: node.loc?.start?.line ? node.loc.start.line - 1 : 0,
            type: "function",
          });
        }
      } else if (node.type === "ClassDeclaration") {
        const name = this.getSymbolName(node);
        if (name) {
          declarations.push({
            name,
            line: node.loc?.start?.line ? node.loc.start.line - 1 : 0,
            type: "class",
          });
        }
      }
    }

    return declarations;
  }

  /**
   * Extract from Tree-Sitter AST format
   */
  _extractFromTreeSitterAST(rootNode) {
    const declarations = [];
    this.log(
      `[DuplicateAnalyzer] Starting extraction. Root Type: ${rootNode?.type}`,
    );

    const traverse = (node) => {
      if (!node) return;

      const nodeType = node.type;
      // console.log(`[DEBUG] Visiting node: ${nodeType} at line ${node.startLine}`);

      // 1️⃣ LEXICAL / VARIABLE DECLARATIONS (const, let, var)
      if (
        nodeType === "variable_declaration" ||
        nodeType === "lexical_declaration"
      ) {
        this.log(`[DEBUG] Found declaration block: ${nodeType}`);

        // JSON format mein children array hota hai
        const declarators =
          node.children?.filter((c) => c.type === "variable_declarator") || [];

        for (const decl of declarators) {
          // Variable name aksar pehla child hota hai jo 'identifier' type ho
          const idNode = decl.children?.find((c) => c.type === "identifier");

          if (idNode) {
            this.log(
              `[DEBUG] Detected variable: '${idNode.text}' at line ${idNode.startLine}`,
            );
            declarations.push({
              name: idNode.text,
              line: idNode.startLine,
              type: "variable",
            });
          }
        }
      }

      // 2️⃣ FUNCTION DECLARATIONS
      else if (
        nodeType === "function_declaration" ||
        nodeType === "function_definition"
      ) {
        const idNode = node.children?.find((c) => c.type === "identifier");
        if (idNode) {
          this.log(
            `[DEBUG] Detected function: '${idNode.text}' at line ${idNode.startLine}`,
          );
          declarations.push({
            name: idNode.text,
            line: idNode.startLine,
            type: "function",
          });
        }
      }

      // 3️⃣ CLASS DECLARATIONS
      else if (
        nodeType === "class_declaration" ||
        nodeType === "class_definition"
      ) {
        const idNode = node.children?.find((c) => c.type === "identifier");
        if (idNode) {
          this.log(
            `[DEBUG] Detected class: '${idNode.text}' at line ${idNode.startLine}`,
          );
          declarations.push({
            name: idNode.text,
            line: idNode.startLine,
            type: "class",
          });
        }
      }

      // 4️⃣ RECURSION (Bhai yahan JSON format ka array traversal hai)
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child) => traverse(child));
      }
    };

    traverse(rootNode);
    this.log(
      `[DuplicateAnalyzer] Extraction finished. Total symbols found: ${declarations.length}`,
    );
    return declarations;
  }

  /**
   * Find duplicates in declarations
   */
  _findDuplicatesInScope(declarations, scopeName) {
    const duplicates = [];
    const seen = new Map(); // name → line number

    for (const decl of declarations) {
      if (seen.has(decl.name)) {
        duplicates.push({
          name: decl.name,
          firstLine: seen.get(decl.name),
          secondLine: decl.line,
          line: decl.line,
          scope: scopeName,
        });
      } else {
        seen.set(decl.name, decl.line);
      }
    }

    return duplicates;
  }

  /**
   * Generate rename suggestions
   */
  _generateRenameSuggestions(baseName) {
    return [
      `${baseName}1`,
      `${baseName}2`,
      `${baseName}_new`,
      `${baseName}_copy`,
      `${baseName}_renamed`,
    ];
  }
}

export default DuplicateDeclarationAnalyzer;
