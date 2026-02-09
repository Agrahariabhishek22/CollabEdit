// utils/highlighter.js
// utils/highlighter.js
import Prism from "prismjs";

// Core languages
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/components/prism-go";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";

const EXTENSION_TO_LANGUAGE = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  java: "java",
  go: "go",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
};
const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const highlightCode = (code, extension) => {
  if (!code) return "";

  const lang =
    EXTENSION_TO_LANGUAGE[extension?.toLowerCase()] || "clike";

  const grammar = Prism.languages[lang];

  if (!grammar) {
    console.warn(`[Highlighter] Grammar not found for ${lang}`);
    return escapeHtml(code);
  }

  try {
    return Prism.highlight(code, grammar, lang);
  } catch (err) {
    console.error("[Highlighter] Highlight failed:", err);
    return escapeHtml(code);
  }
};
