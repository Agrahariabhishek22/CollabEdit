#!/bin/sh

# Folder clean aur setup
rm -rf public/parsers
mkdir -p public/parsers

echo "🚀 v0.25.1 (Latest ABI 15) par upgrade kar raha hoon..."

# 1. Main Engine & Driver (v0.25.1)
# Is version mein driver ka structure updated hai jo ABI 15 ko properly handle karega
curl -L "https://cdn.jsdelivr.net/npm/web-tree-sitter@0.25.1/tree-sitter.js" -o public/parsers/tree-sitter.js
curl -L "https://cdn.jsdelivr.net/npm/web-tree-sitter@0.25.1/tree-sitter.wasm" -o public/parsers/tree-sitter.wasm

echo "Downloading Latest ABI 15 Grammars..."

# 2. Individual Grammars (Using @latest to ensure ABI 15)
curl -L "https://unpkg.com/tree-sitter-javascript@latest/tree-sitter-javascript.wasm" -o public/parsers/tree-sitter-javascript.wasm
curl -L "https://unpkg.com/tree-sitter-cpp@latest/tree-sitter-cpp.wasm" -o public/parsers/tree-sitter-cpp.wasm
curl -L "https://unpkg.com/tree-sitter-python@latest/tree-sitter-python.wasm" -o public/parsers/tree-sitter-python.wasm
curl -L "https://unpkg.com/tree-sitter-java@latest/tree-sitter-java.wasm" -o public/parsers/tree-sitter-java.wasm
curl -L "https://unpkg.com/tree-sitter-c@latest/tree-sitter-c.wasm" -o public/parsers/tree-sitter-c.wasm

echo "✅ Upgrade Complete! Files check:"
ls -lh public/parsers/