// hooks/useAutocomplete.js

import { useEffect, useState, useRef } from "react";

/**
 * Context-Aware Autocomplete Hook
 * 
 * Features:
 * - Context detection (inside class, function, if statement, etc)
 * - Smart suggestions based on context
 * - Frequency tracking of used identifiers
 * - Scoring algorithm (frequency + recency + relevance)
 * - Language-specific keywords
 * - Multi-language support
 */

const KEYWORDS = {
  javascript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "try", "catch", "finally",
    "throw", "class", "extends", "import", "export", "default", "async", "await",
    "new", "this", "super", "static", "get", "set", "yield", "typeof", "instanceof",
    "delete", "void", "in", "of", "from", "as",
  ],
  typescript: [
    // All JS keywords +
    "interface", "type", "enum", "namespace", "declare", "readonly", "abstract",
    "implements", "keyof", "infer", "is", "satisfies",
  ],
  python: [
    "def", "class", "if", "elif", "else", "for", "while", "break", "continue",
    "return", "yield", "import", "from", "as", "try", "except", "finally", "raise",
    "with", "assert", "pass", "del", "lambda", "global", "nonlocal", "and", "or", "not",
  ],
};

const BUILTIN_FUNCTIONS = {
  javascript: [
    "console.log", "console.error", "console.warn", "console.info",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "JSON.parse", "JSON.stringify",
    "Array.isArray", "Object.keys", "Object.values", "Object.entries",
    "Math.floor", "Math.ceil", "Math.round", "Math.max", "Math.min",
    "parseInt", "parseFloat", "isNaN", "isFinite",
  ],
  python: [
    "print", "len", "range", "enumerate", "map", "filter", "zip",
    "sorted", "reversed", "sum", "max", "min", "abs",
    "isinstance", "type", "id", "hash", "dir", "vars",
    "open", "input", "str", "int", "float", "bool", "list", "dict", "set", "tuple",
  ],
};

export function useAutocomplete(content, tree, cursorIndex = 0, language = "javascript") {
  // ============================================================================
  // State
  // ============================================================================
  const [suggestions, setSuggestions] = useState([]);
  const [context, setContext] = useState(null);
  const frequencyMapRef = useRef(new Map());
  const lastCursorRef = useRef(cursorIndex);

  // ============================================================================
  // EFFECT 1: Build frequency map from content
  // ============================================================================
  useEffect(() => {
    const identifiers = extractIdentifiers(content, language);
    const freqMap = new Map();

    identifiers.forEach((id) => {
      freqMap.set(id, (freqMap.get(id) || 0) + 1);
    });

    frequencyMapRef.current = freqMap;
  }, [content, language]);

  // ============================================================================
  // EFFECT 2: Detect context when cursor moves
  // ============================================================================
  useEffect(() => {
    if (!tree) {
      setContext(null);
      return;
    }

    const detectedContext = detectContext(tree, cursorIndex, content);
    setContext(detectedContext);
    lastCursorRef.current = cursorIndex;
  }, [tree, cursorIndex, content]);

  // ============================================================================
  // MAIN: Generate suggestions based on prefix and context
  // ============================================================================
  const generateSuggestions = (prefix, cursorIdx) => {
    if (prefix.length === 0) return [];

    const detectedCtx = context || detectContext(tree, cursorIdx, content);
    const candidates = new Set();

    // ✅ 1. Context-aware suggestions
    const contextSuggestions = getContextualSuggestions(detectedCtx, language);
    contextSuggestions.forEach((sug) => {
      if (sug.startsWith(prefix)) candidates.add(sug);
    });

    // ✅ 2. Keywords
    KEYWORDS[language]?.forEach((kw) => {
      if (kw.startsWith(prefix)) candidates.add(kw);
    });

    // ✅ 3. Built-in functions
    BUILTIN_FUNCTIONS[language]?.forEach((fn) => {
      if (fn.startsWith(prefix)) candidates.add(fn);
    });

    // ✅ 4. Previously used identifiers
    frequencyMapRef.current.forEach((freq, id) => {
      if (id.startsWith(prefix) && id !== prefix) {
        candidates.add(id);
      }
    });

    // ✅ 5. Score and rank
    const scored = Array.from(candidates).map((candidate) => {
      const score = calculateScore(
        candidate,
        prefix,
        cursorIdx,
        frequencyMapRef.current.get(candidate) || 1,
        detectedCtx,
        language
      );
      return { 
        text: candidate, 
        score,
        category: categorizeCandidate(candidate, language),
        context: detectedCtx?.type || "global",
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 15); // Top 15
  };

  // ============================================================================
  // Accept suggestion (for Tab/Enter)
  // ============================================================================
  const acceptSuggestion = (suggestion) => {
    return suggestion.text;
  };

  return {
    suggestions,
    setSuggestions,
    generateSuggestions,
    acceptSuggestion,
    context, // Expose context for debugging/UI
  };
}

// ============================================================================
// CORE LOGIC: Detect context from tree
// ============================================================================
/**
 * Detect what kind of scope/context cursor is in
 * Returns: { type, parent, inString, inComment }
 */
function detectContext(tree, cursorIndex, content) {
  if (!tree) return null;

  // Find node at cursor
  const validCursorIndex = Math.max(0, Math.min(cursorIndex, content.length - 1));
const node = tree.rootNode.descendantForIndex(validCursorIndex, validCursorIndex);

  if (!node) {
    return {
      type: "global",
      parent: null,
      depth: 0,
      inString: false,
      inComment: false,
    };
  }

  let currentNode = node;
  let depth = 0;
  const nodeChain = [];

  // Walk up the tree to find context
  while (currentNode) {
    nodeChain.push(currentNode.type);
    currentNode = currentNode.parent;
    depth++;

    if (depth > 20) break; // Prevent infinite loop
  }

  // Determine context
  const contextType = determineContextType(nodeChain);

  return {
    type: contextType,
    nodeChain,
    depth,
    inString: isInString(nodeChain),
    inComment: isInComment(nodeChain),
    parentType: nodeChain[1] || "global", // Second element
    node,
  };
}

/**
 * Determine context type from node chain
 */
function determineContextType(nodeChain) {
  // Check from innermost to outermost (nodeChain is bottom-up)
  
  // Inside string/comment
  if (nodeChain[0]?.includes("string") || nodeChain[0]?.includes("comment")) {
    return "string_or_comment";
  }

  // Inside class body
  if (nodeChain.some((t) => t === "class_body")) {
    return "class_body";
  }

  // Inside method/function
  if (nodeChain.some((t) => t === "method_definition" || t === "function_declaration")) {
    return "function_body";
  }

  // Inside object literal
  if (nodeChain.some((t) => t === "object" || t === "object_pattern")) {
    return "object_literal";
  }

  // Inside array
  if (nodeChain.some((t) => t === "array" || t === "array_pattern")) {
    return "array_literal";
  }

  // Inside if/for/while condition/body
  if (nodeChain.some((t) =>
    ["if_statement", "for_statement", "while_statement", "do_statement"].includes(t)
  )) {
    return "control_flow";
  }

  // Inside switch
  if (nodeChain.some((t) => t === "switch_statement")) {
    return "switch_statement";
  }

  // Inside try/catch
  if (nodeChain.some((t) => ["try_statement", "catch_clause"].includes(t))) {
    return "error_handling";
  }

  // Default
  return "global";
}

/**
 * Get suggestions based on detected context
 */
function getContextualSuggestions(context, language) {
  if (!context) return [];

  const suggestions = new Set();

  switch (context.type) {
    case "class_body":
      // Inside class: suggest methods, properties, constructors
      if (language === "javascript" || language === "typescript") {
        suggestions.add("constructor");
        suggestions.add("method");
        suggestions.add("property");
        suggestions.add("async method");
        suggestions.add("static method");
        suggestions.add("get");
        suggestions.add("set");
      }
      break;

    case "function_body":
      // Inside function: suggest common function patterns
      suggestions.add("return");
      suggestions.add("const");
      suggestions.add("let");
      suggestions.add("if");
      suggestions.add("for");
      suggestions.add("while");
      if (language === "javascript" || language === "typescript") {
        suggestions.add("try");
        suggestions.add("throw");
      }
      break;

    case "control_flow":
      // Inside if/for/while: suggest boolean/condition keywords
      suggestions.add("true");
      suggestions.add("false");
      suggestions.add("null");
      suggestions.add("undefined");
      if (language === "javascript" || language === "typescript") {
        suggestions.add("typeof");
        suggestions.add("instanceof");
      }
      break;

    case "object_literal":
      // Inside object: suggest property keys
      suggestions.add("key:");
      suggestions.add("value:");
      if (language === "javascript" || language === "typescript") {
        suggestions.add("method():");
        suggestions.add("getter:");
      }
      break;

    case "array_literal":
      // Inside array: general values
      suggestions.add("item");
      suggestions.add("value");
      break;

    case "switch_statement":
      // Inside switch: suggest case/break
      suggestions.add("case");
      suggestions.add("break");
      suggestions.add("default");
      break;

    case "error_handling":
      // Inside try/catch: suggest error patterns
      suggestions.add("catch");
      suggestions.add("finally");
      suggestions.add("throw");
      suggestions.add("error");
      break;

    default:
      // Global scope: suggest common patterns
      if (language === "javascript" || language === "typescript") {
        suggestions.add("function");
        suggestions.add("class");
        suggestions.add("const");
      }
      if (language === "python") {
        suggestions.add("def");
        suggestions.add("class");
      }
  }

  return Array.from(suggestions);
}

// ============================================================================
// Helper: Check if inside string
// ============================================================================
function isInString(nodeChain) {
  return nodeChain[0]?.includes("string") || false;
}

// ============================================================================
// Helper: Check if inside comment
// ============================================================================
function isInComment(nodeChain) {
  return nodeChain[0]?.includes("comment") || false;
}

// ============================================================================
// SCORING ALGORITHM: Frequency + Relevance + Recency
// ============================================================================
function calculateScore(candidate, prefix, cursorIndex, frequency, context, language) {
  let score = 0;

  // 1. Prefix match (0-40 points)
  const prefixLength = prefix.length;
  const candidateLength = candidate.length;
  const prefixScore = (prefixLength / candidateLength) * 40;
  score += prefixScore;

  // 2. Frequency score (0-30 points)
  const frequencyScore = Math.min(frequency * 3, 30);
  score += frequencyScore;

  // 3. Context relevance (0-30 points)
  const contextRelevance = getContextRelevance(candidate, context, language);
  score += contextRelevance;

  // 4. Category bonus (0-10 points)
  const category = categorizeCandidate(candidate, language);
  const categoryBonus = getCategoryBonus(category);
  score += categoryBonus;

  // 5. Length penalty (shorter is better, -5 to 0)
  // Prefer shorter suggestions for quicker typing
  const lengthPenalty = Math.max(-5, -(candidateLength - 5) * 0.2);
  score += lengthPenalty;

  return score;
}

// ============================================================================
// Get context relevance score
// ============================================================================
function getContextRelevance(candidate, context, language) {
  if (!context) return 0;

  const lowerCandidate = candidate.toLowerCase();

  switch (context.type) {
    case "class_body":
      if (["constructor", "method", "property", "static", "get", "set"].some(k => lowerCandidate.includes(k))) {
        return 30;
      }
      break;

    case "function_body":
      if (["return", "const", "let", "if", "for", "while", "try"].some(k => lowerCandidate.startsWith(k))) {
        return 25;
      }
      break;

    case "control_flow":
      if (["true", "false", "null", "undefined"].includes(lowerCandidate)) {
        return 28;
      }
      break;

    case "object_literal":
      if (lowerCandidate.includes(":") || lowerCandidate.includes("key")) {
        return 25;
      }
      break;

    case "error_handling":
      if (["catch", "finally", "error", "throw"].some(k => lowerCandidate.includes(k))) {
        return 26;
      }
      break;
  }

  return 0;
}

// ============================================================================
// Categorize candidate
// ============================================================================
function categorizeCandidate(candidate, language) {
  const lowerCandidate = candidate.toLowerCase();

  if (KEYWORDS[language]?.includes(candidate)) {
    return "keyword";
  }
  if (BUILTIN_FUNCTIONS[language]?.includes(candidate)) {
    return "builtin";
  }
  if (candidate.includes(".") || candidate.includes("(")) {
    return "method";
  }
  if (candidate[0] === candidate[0].toUpperCase()) {
    return "class";
  }
  return "variable";
}

// ============================================================================
// Get category bonus
// ============================================================================
function getCategoryBonus(category) {
  const bonuses = {
    keyword: 8,
    builtin: 7,
    method: 5,
    class: 6,
    variable: 4,
  };
  return bonuses[category] || 0;
}

// ============================================================================
// Extract identifiers from code
// ============================================================================
function extractIdentifiers(content, language) {
  // Regex to find valid identifiers
  const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
  const matches = [...content.matchAll(identifierRegex)];

  return matches
    .map((m) => m[1])
    .filter((id) => id.length > 1 && !isKeyword(id, language));
}

// ============================================================================
// Check if word is keyword
// ============================================================================
function isKeyword(word, language) {
  return KEYWORDS[language]?.includes(word) || false;
}