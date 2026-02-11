#!/bin/sh

# Folder create karo
mkdir -p public/parsers

echo "🚀 Tree-sitter WASM files download ho rahi hain from UNPKG (Reliable)..."

# 1. Main Tree-sitter Runtime
curl -L https://unpkg.com/web-tree-sitter@0.20.8/tree-sitter.wasm -o public/parsers/tree-sitter.wasm

# 2. Individual Grammars (Using Unpkg for stability)
echo "Downloading Grammars..."

# Note: Hum version match kar rahe hain (0.20.0 or latest compatible)
curl -L https://unpkg.com/tree-sitter-javascript/tree-sitter-javascript.wasm -o public/parsers/tree-sitter-javascript.wasm
curl -L https://unpkg.com/tree-sitter-cpp/tree-sitter-cpp.wasm -o public/parsers/tree-sitter-cpp.wasm
curl -L https://unpkg.com/tree-sitter-python/tree-sitter-python.wasm -o public/parsers/tree-sitter-python.wasm
curl -L https://unpkg.com/tree-sitter-java/tree-sitter-java.wasm -o public/parsers/tree-sitter-java.wasm
curl -L https://unpkg.com/tree-sitter-c/tree-sitter-c.wasm -o public/parsers/tree-sitter-c.wasm

echo "✅ Done! Files in public/parsers/:"
ls -lh public/parsers/