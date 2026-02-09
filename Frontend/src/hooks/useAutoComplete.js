// hooks/useAutocomplete.js

import { useEffect, useState, useRef } from "react";

const KEYWORDS = {
  javascript: [
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "try", "catch", "finally",
    "throw", "class", "extends", "import", "export", "default", "async", "await",
    "new", "this", "super", "static", "get", "set", "yield", "typeof", "instanceof",
  ],
};

export function useAutocomplete(content, tree, triggerChar = null, language = "javascript") {
  const [suggestions, setSuggestions] = useState([]);
  const frequencyMapRef = useRef(new Map());

  // 🟢 Build frequency map from content
  useEffect(() => {
    const identifiers = extractIdentifiers(content, language);
    const freqMap = new Map();
    console.log(`[Autocomplete] Generated ${identifiers.length} identifiers for "${language}"`);

    identifiers.forEach((id) => {
      freqMap.set(id, (freqMap.get(id) || 0) + 1);
    });

    frequencyMapRef.current = freqMap;
  }, [content, language]);

  // 🟢 Generate suggestions on trigger
  const generateSuggestions = (prefix, cursorIndex) => {
    if (prefix.length === 0) return [];

    const candidates = new Set();

    // 1. Keywords
    KEYWORDS[language]?.forEach((kw) => {
      if (kw.startsWith(prefix)) {
        candidates.add(kw);
      }
    });

    // 2. Previously used identifiers
    frequencyMapRef.current.forEach((freq, id) => {
      if (id.startsWith(prefix) && id !== prefix) {
        candidates.add(id);
      }
    });

    // 3. Score & rank
    const scored = Array.from(candidates).map((candidate) => {
      const score = calculateScore(
        candidate,
        prefix,
        cursorIndex,
        frequencyMapRef.current.get(candidate) || 1
      );
      return { text: candidate, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    console.log(`[Autocomplete] Generated ${scored.length} suggestions for "${prefix}"`);
    return scored.slice(0, 10); // Top 10
  };

  // 🟢 Handle Tab key acceptance
  const acceptSuggestion = (suggestion) => {
    return suggestion.text;
  };

  return {
    suggestions,
    setSuggestions,
    generateSuggestions,
    acceptSuggestion,
  };
}

// 🟢 SCORING ALGORITHM: Frequency + Distance
function calculateScore(candidate, prefix, cursorIndex, frequency) {
  let score = 0;

  // 1. Frequency score (0-50 points)
  // Common identifiers used more often get higher score
  const frequencyScore = Math.min(frequency * 5, 50);

  // 2. Prefix match score (0-30 points)
  // Exact prefix match at start gets highest score
  const prefixLength = prefix.length;
  const candidateLength = candidate.length;
  const prefixMatchScore = (prefixLength / candidateLength) * 30;

  // 3. Recency score (0-20 points)
  // Recently typed characters nearby get boost
  // (Can implement by tracking cursor position changes)
  const recencyScore = 15; // Placeholder

  score = frequencyScore + prefixMatchScore ;

  console.log(
    `[Score] "${candidate}": freq=${frequencyScore.toFixed(1)}, prefix=${prefixMatchScore.toFixed(1)}, total=${score.toFixed(1)}`
  );

  return score;
}

// 🟢 Extract identifiers from code
function extractIdentifiers(content, language) {
  // if (language !== "javascript") return [];

  // Regex to find valid identifiers
  const identifierRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
  const matches = [...content.matchAll(identifierRegex)];

  return matches.map((m) => m[1]).filter((id) => id.length > 1);
}