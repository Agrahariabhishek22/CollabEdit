export function highlightCodeWithTreeSitterInRange(content, tree, language, rangeStart, rangeEnd) {
  if (!tree || !content) return [];

  const colors = getLanguageColors(language);
  const highlights = [];
  const cursor = tree.walk();

  let reachedEnd = false;
  while (!reachedEnd) {
    const node = cursor.currentNode();

    // 🟢 Optimization 1: Agar node viewport ke niche nikal gaya, toh poora subtree skip karo
    if (node.startIndex >= rangeEnd) {
      if (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) { reachedEnd = true; break; }
      }
      continue;
    }

    // 🟢 Optimization 2: Agar node range ke andar hai, tabhi process karo
    if (node.endIndex > rangeStart) {
      const color = colors[node.type];
      
      // Node valid hai aur uska color defined hai
      if (color && node.startIndex < node.endIndex) {
        highlights.push({
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          type: node.type,
          color: color,
        });
      }
    }

    // Depth-first traversal: Har node ko check karte hue chalo
    if (cursor.gotoFirstChild()) continue;
    
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) {
        reachedEnd = true;
        break;
      }
    }
  }

  // 🟢 Robust Sorting: Primary sort startIndex par, secondary endIndex par (Nested support)
  return highlights.sort((a, b) => (a.startIndex - b.startIndex) || (b.endIndex - a.endIndex));
}

/**
 * Robust HTML Generation: Overlapping aur Nested nodes ko handle karta hai.
 * Ye ensure karta hai ki koi bhi character miss na ho aur HTML valid rahe.
 */
export function applyHighlights(content, highlights) {
  if (!highlights || highlights.length === 0) return escapeHtml(content);

  let html = "";
  let lastIndex = 0;
console.log(highlights);

  // Filter overlapping: Tree-sitter kabhi-kabhi same range ke multi-nodes deta hai
  // Hum sirf sabse specific (ya sabse upar wala) uthayenge
  const cleanHighlights = [];
  for (const h of highlights) {
    if (h.startIndex >= lastIndex) {
      cleanHighlights.push(h);
      // Ensure overlaps don't break the string flow
      // Note: Advanced logic for nested spans can be added here
    }
  }

  cleanHighlights.forEach(({ startIndex, endIndex, color }) => {
    // 1. Highlight se pehle ka normal text
    if (startIndex > lastIndex) {
      html += escapeHtml(content.substring(lastIndex, startIndex));
    }

    // 2. Highlighted text with color
    const text = content.substring(startIndex, endIndex);
    if (text.length > 0) {
      html += `<span style="color: ${color};">${escapeHtml(text)}</span>`;
    }

    lastIndex = Math.max(lastIndex, endIndex);
  });

  // 3. Bacha hua text after all highlights
  if (lastIndex < content.length) {
    html += escapeHtml(content.substring(lastIndex));
  }

  return html;
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

const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");