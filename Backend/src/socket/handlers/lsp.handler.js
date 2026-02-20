// src/socket/handlers/lsp.handler.js
// COMPLETE - All 5 languages supported

import { prisma } from "../../config/database.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ESM Imports
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import Cpp from "tree-sitter-cpp";
import Go from "tree-sitter-go";
import JavaScript from "tree-sitter-javascript"; // New replacement for Babel
// Parser instances ko class ke bahar ya constructor mein initialize karna best hai
const parser = new Parser();

class LSPHandler {
  constructor(io, lspManager, yjsDocManager, permissionValidator, astHandler) {
    this.io = io;
    this.lspManager = lspManager;
    this.yjsDocManager = yjsDocManager;
    this.permissionValidator = permissionValidator;
    this.astHandler = astHandler;
    this.astCache = new Map();
    this.analysisTimers = new Map();
  }
  setASTHandler(handler) {
    this.astHandler = handler;
    console.log("[LSPHandler] ASTHandler instance linked successfully.");
  }
  register(socket) {
    socket.on("lsp:analyze", async ({ fileId }) => {
      await this.handleAnalyze(socket, fileId);
    });

    socket.on("lsp:completion", async ({ fileId, position }) => {
      await this.handleCompletion(socket, fileId, position);
    });

    socket.on("lsp:hover", async ({ fileId, position }) => {
      await this.handleHover(socket, fileId, position);
    });
  }

  scheduleAnalysis(fileId, filePath, projectRoot) {
    if (this.analysisTimers.has(fileId)) {
      clearTimeout(this.analysisTimers.get(fileId));
    }

    const timer = setTimeout(async () => {
      try {
        await this.runAnalysis(fileId, filePath, projectRoot);
      } catch (err) {
        console.error("[LSP] Analysis error:", err);
      }
      this.analysisTimers.delete(fileId);
    }, 800);

    this.analysisTimers.set(fileId, timer);
  }

  async getLSPContext(fileId, code, language) {
    try {
      const cacheKey = `${fileId}:${(Date.now() / 30000) | 0}`;
      if (this.astCache.has(cacheKey)) {
        return this.astCache.get(cacheKey);
      }

      const fileMeta = await prisma.fileMeta.findUnique({
        where: { id: fileId },
        include: { project: true },
      });

      if (!fileMeta) {
        console.error(`[LSPHandler] File metadata not found: ${fileId}`);
        return null;
      }

      const lspProc = await this.lspManager.spawn(
        fileId,
        fileMeta.absolutePath,
        fileMeta.project.rootPath,
      );

      if (!lspProc) {
        console.error(`[LSPHandler] LSP spawn failed for ${fileId}`);
        return null;
      } else {
        console.log(
          `[LSPHandler] LSP process ready for ${fileId}, requesting analysis...${lspProc}`,
        );
      }

      const ast = await this._parseToAST(code, language);
      console.log("[LSP Handler] AST generated for LSP context ");

      let diagnostics = [];
      try {
        const diagnosticsJson = await this.yjsDocManager.redis.get(
          `lsp:diagnostics:${fileId}`,
        );
        diagnostics = diagnosticsJson ? JSON.parse(diagnosticsJson) : [];
      } catch (err) {
        console.warn(
          "[LSPHandler] Could not get LSP diagnostics:",
          err.message,
        );
      }

      const context = {
        ast,
        diagnostics,
        code,
        language,
      };

      this.astCache.set(cacheKey, context);
      return context;
    } catch (err) {
      console.error(`[LSPHandler] getLSPContext error:`, err.message);
      return null;
    }
  }

  /**
   * Parse code to AST for any language
   * Supports: JavaScript, Python, Java, C++, Go
   */
  async _parseToAST(code, language) {
    try {
      if (!code) return { type: "Program", body: [] };
      if (global.lspSanitizer) {
        code = global.lspSanitizer.sanitize(code);
      }

      switch (language) {
        case "javascript":
        case "jsx":
          return await this._parseJavaScript(code);
        case "python":
          return await this._parsePython(code);
        case "java":
          return await this._parseJava(code);
        case "cpp":
          return await this._parseCpp(code);
        case "go":
          return await this._parseGo(code);
        default:
          console.warn(`[LSPHandler] No parser for language: ${language}`);
          return { type: "Program", body: [] };
      }
    } catch (err) {
      console.error(
        `[LSPHandler] AST parse error for ${language}:`,
        err.message,
      );
      return { type: "Program", body: [] };
    }
  }

  /**
   * Parse JavaScript/TypeScript using @babel/parser
   */
  /**
   * Parse JavaScript using Babel (ESM)
   */
  async _parseJavaScript(code) {
    // Tree-sitter-javascript natively supports modern JS and JSX
    return this._parseWithTreeSitter(code, JavaScript, "javascript");
  }

  /**
   * Generic Tree-Sitter Parser (Ab repetitive code ki zaroorat nahi)
   */
  async _parseWithTreeSitter(code, languageModule, languageName) {
    try {
      parser.setLanguage(languageModule);
      const tree = parser.parse(code);
      // console.log("[LSPHandler] Parsed tree is: ",tree);

      return this._extractTreeSitterNodes(tree.rootNode, languageName);
    } catch (err) {
      console.error(`[LSPHandler] ${languageName} parse failed:`, err.message);
      return { type: "Program", body: [] };
    }
  }

  // Ab aapke specific methods chote ho jayenge:
  async _parsePython(code) {
    return this._parseWithTreeSitter(code, Python, "python");
  }
  async _parseJava(code) {
    return this._parseWithTreeSitter(code, Java, "java");
  }
  async _parseCpp(code) {
    return this._parseWithTreeSitter(code, Cpp, "cpp");
  }
  async _parseGo(code) {
    return this._parseWithTreeSitter(code, Go, "go");
  }

  /**
   * Extract nodes from tree-sitter AST (Python, Java, C++, Go)
   */
  /**
   * Extract COMPLETE tree from tree-sitter
   * Returns full AST with all nodes for frontend
   * (indentation, syntax highlighting, error detection)
   */
  _extractTreeSitterNodes(rootNode, language) {
    const traverse = (node, depth = 0) => {
      if (!node) return null;

      // Basic node info
      const nodeData = {
        id: `${node.startPosition.row}-${node.startPosition.column}`, // Unique ID
        type: node.type,
        text: node.text, // Full text of this node
        startLine: node.startPosition.row,
        startCol: node.startPosition.column,
        endLine: node.endPosition.row,
        endCol: node.endPosition.column,
        isNamed: node.isNamed, // Named nodes only (ignore whitespace/punctuation)
        children: [],
      };

      // Extract children (ONLY named nodes to reduce payload)
      let child = node.firstChild;
      while (child) {
        if (child.isNamed) {
          // Only named nodes (not whitespace, not punctuation)
          const childData = traverse(child, depth + 1);
          if (childData) {
            nodeData.children.push(childData);
          }
        }
        child = child.nextSibling;
      }

      return nodeData;
    };

    const root = traverse(rootNode);

    return {
      type: "Program",
      language,
      root: root, // Full tree structure
      totalNodes: this._countNodes(root),
    };
  }

  /**
   * Count total nodes (for logging)
   */
  _countNodes(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children && Array.isArray(node.children)) {
      count += node.children.reduce(
        (sum, child) => sum + this._countNodes(child),
        0,
      );
    }
    return count;
  }
  // _extractTreeSitterNodes(rootNode, language) {
  //   const declarations = [];

  //   const traverse = (node) => {
  //     if (!node) return;

  //     const nodeType = node.type;

  //     if (language === "python") {
  //       if (nodeType === "function_definition") {
  //         const nameNode = node.child(1);
  //         declarations.push({
  //           type: "FunctionDeclaration",
  //           name: nameNode?.text || "anonymous",
  //           line: node.startPosition.row + 1,
  //         });
  //       }
  //       if (nodeType === "class_definition") {
  //         const nameNode = node.child(1);
  //         declarations.push({
  //           type: "ClassDeclaration",
  //           name: nameNode?.text || "anonymous",
  //           line: node.startPosition.row + 1,
  //         });
  //       }
  //     }

  //     if (language === "java") {
  //       if (nodeType === "method_declaration") {
  //         const nameNode = node.child(3);
  //         declarations.push({
  //           type: "FunctionDeclaration",
  //           name: nameNode?.text || "anonymous",
  //           line: node.startPosition.row + 1,
  //         });
  //       }
  //       if (nodeType === "class_declaration") {
  //         const nameNode = node.child(1);
  //         declarations.push({
  //           type: "ClassDeclaration",
  //           name: nameNode?.text || "anonymous",
  //           line: node.startPosition.row + 1,
  //         });
  //       }
  //     }

  //     if (language === "cpp") {
  //       if (nodeType === "function_definition") {
  //         const nameNode = node.childByFieldName("declarator");
  //         if (nameNode) {
  //           declarations.push({
  //             type: "FunctionDeclaration",
  //             name: nameNode.text,
  //             line: node.startPosition.row + 1,
  //           });
  //         }
  //       }
  //     }

  //     if (language === "go") {
  //       if (nodeType === "function_declaration") {
  //         const nameNode = node.childByFieldName("name");
  //         declarations.push({
  //           type: "FunctionDeclaration",
  //           name: nameNode?.text || "anonymous",
  //           line: node.startPosition.row + 1,
  //         });
  //       }
  //     }

  //     let child = node.firstChild;
  //     while (child) {
  //       traverse(child);
  //       child = child.nextSibling;
  //     }
  //   };

  //   traverse(rootNode);

  //   return {
  //     type: "Program",
  //     language,
  //     body: declarations,
  //   };
  // }

  async runAnalysis(fileId, filePath, projectRoot) {
    try {
      const docData = await this.yjsDocManager.getOrCreateDoc(fileId);
      const content = docData.ytext.toString();
      if (global.lspSanitizer) {
        content = global.lspSanitizer.sanitize(content);
      }

      const lspProc = await this.lspManager.spawn(
        fileId,
        filePath,
        projectRoot,
      );

      await this.lspManager.didChange(fileId, filePath, content, Date.now());

      console.log(`[LSP] Analysis triggered for ${fileId}`);

      if (this.astHandler) {
        const language = this.lspManager.detectLanguage(
          require("path").extname(filePath),
        );
        const ast = await this._parseToAST(content, language || "javascript");
        if (ast) {
          await this.astHandler.broadcastDelta(fileId, ast);
          console.log(`[LSPHandler] AST delta broadcasted for ${fileId}`);
        }
      }

      this.astCache.forEach((val, key) => {
        if (key.startsWith(fileId)) this.astCache.delete(key);
      });
    } catch (err) {
      console.error("[LSP] Run analysis error:", err);
    }
  }

  async handleAnalyze(socket, fileId) {
    const { userId } = socket;

    try {
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        "READ",
      );

      if (!validation.allowed) {
        return socket.emit("lsp:error", {
          fileId,
          message: "Access denied",
        });
      }

      const file = await prisma.fileMeta.findUnique({
        where: { id: fileId },
        include: { project: true },
      });

      if (!file) {
        return socket.emit("lsp:error", {
          fileId,
          message: "File not found",
        });
      }

      await this.runAnalysis(fileId, file.absolutePath, file.project.rootPath);

      socket.emit("lsp:analyzing", { fileId });
    } catch (err) {
      console.error("[LSP] Analyze error:", err);
      socket.emit("lsp:error", {
        fileId,
        message: err.message,
      });
    }
  }

  async handleCompletion(socket, fileId, position) {
    try {
      socket.emit("lsp:completion-result", {
        fileId,
        items: [],
      });
    } catch (err) {
      console.error("[LSP] Completion error:", err);
    }
  }

  async handleHover(socket, fileId, position) {
    try {
      socket.emit("lsp:hover-result", {
        fileId,
        content: null,
      });
    } catch (err) {
      console.error("[LSP] Hover error:", err);
    }
  }
}

export default LSPHandler;
