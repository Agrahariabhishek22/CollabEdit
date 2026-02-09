// utils/treeSitterHighlighter.js

export function highlightCodeWithTreeSitter(content, tree, language = "javascript") {
  if (!tree || !content) return content;

  const colors = getLanguageColors(language);
  const highlights = [];

  // 🟢 Walk through tree और सब nodes को highlight करो
  const cursor = tree.walk();
  let reachedEnd = false;

  while (!reachedEnd) {
    const node = cursor.currentNode();

    // 🟢 Node type के basis पर color decide करो
    const color = colors[node.type];

    if (color) {
      highlights.push({
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        type: node.type,
        color: color,
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

  // 🟢 Sort by startIndex ताकि overlapping न हो
  highlights.sort((a, b) => a.startIndex - b.startIndex);

  return highlights;
}

// 🟢 Language-specific color mapping
function getLanguageColors(language) {
  const baseColors = {
    // Keywords
    keyword: "#ff7b72",           // Red
    "keyword.function": "#ff7b72",
    "keyword.return": "#ff7b72",
    "keyword.control": "#ff7b72",

    // Identifiers
    identifier: "#79c0ff",        // Blue
    variable: "#79c0ff",
    property: "#79c0ff",
    "function.call": "#d2a8ff",   // Purple
    function: "#d2a8ff",
    "function.definition": "#d2a8ff",

    // Strings
    string: "#a5d6ff",            // Light Blue
    "string.special": "#a5d6ff",
    template_string: "#a5d6ff",

    // Numbers & Constants
    number: "#79f0ca",            // Green
    constant: "#79f0ca",
    "constant.builtin": "#79f0ca",

    // Comments
    comment: "#8b949e",           // Gray
    "comment.line": "#8b949e",
    "comment.block": "#8b949e",

    // Operators
    operator: "#ff7b72",

    // Types
    type: "#ffa657",              // Orange
    "type.builtin": "#ffa657",
  };

  // Language-specific tweaks
  if (language === "python") {
    return {
      ...baseColors,
      "keyword.class": "#ff7b72",
      "keyword.def": "#ff7b72",
    };
  }

  if (language === "cpp" || language === "c") {
    return {
      ...baseColors,
      "primitive_type": "#ffa657",
      "type.qualifier": "#ff7b72",
    };
  }

  return baseColors;
}

// 🟢 Convert highlights to HTML spans
export function applyHighlights(content, highlights) {
  if (highlights.length === 0) return escapeHtml(content);

  let html = "";
  let lastIndex = 0;

  highlights.forEach(({ startIndex, endIndex, color }) => {
    // Add text before this highlight
    html += escapeHtml(content.substring(lastIndex, startIndex));

    // Add highlighted text
    const text = content.substring(startIndex, endIndex);
    html += `<span style="color: ${color};">${escapeHtml(text)}</span>`;

    lastIndex = endIndex;
  });

  // Add remaining text
  html += escapeHtml(content.substring(lastIndex));

  return html;
}

const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");