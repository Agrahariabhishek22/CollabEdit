
---
## Data Flow Explanation 📍
```
1️⃣ USER TYPES:
   InputLayer onChange → WidgetLayer monitors

2️⃣ TREE-SITTER PARSE (300ms debounce):
   useTreeSitter hooks
   ├─ Load WASM grammar (js/cpp/tsx once)
   ├─ Incremental parse (tree passed for speed)
   ├─ Extract ERROR nodes
   └─ Return {tree, errors}

3️⃣ AUTOCOMPLETE GENERATION (Tab key):
   useAutocomplete hooks
   ├─ Extract identifiers from content
   ├─ Build frequency map
   ├─ Score: frequency × prefix match
   └─ Return top 10 sorted suggestions

4️⃣ SMART INDENT (Enter key):
   useSmartIndent hooks
   ├─ Find cursor's AST depth
   ├─ Check if inside block
   ├─ Return proper spacing
   └─ Insert indent automatically

5️⃣ UI RENDERING:
   SyntaxErrorWidget: Show wavy red lines
   SuggestionDropdown: Show scored list


USER TYPES
    ↓
InputLayer onChange
    ↓
WidgetLayer monitors input
    ↓
┌─────────────────────────────────────────┐
│ useTreeSitter Hook                      │
├─────────────────────────────────────────┤
│ 1. Detect language (js/cpp/tsx)         │
│ 2. Load WASM grammar (once)             │
│ 3. Incremental parse (300ms debounce)   │
│ 4. Extract ERROR nodes                  │
│ 5. Return tree + errors                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ useAutocomplete Hook                    │
├─────────────────────────────────────────┤
│ 1. Extract identifiers from content     │
│ 2. Build frequency map                  │
│ 3. On Tab: generate suggestions         │
│ 4. Score: frequency + prefix match      │
│ 5. Return top 10 suggestions            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ WidgetLayer Components                  │
├─────────────────────────────────────────┤
│ 1. SyntaxErrorWidget: Display errors    │
│ 2. SuggestionDropdown: Show autocomplete│
│ 3. SmartIndent: Handle Enter key        │
└─────────────────────────────────────────┘
    ↓
VISUAL FEEDBACK (Errors + Suggestions)