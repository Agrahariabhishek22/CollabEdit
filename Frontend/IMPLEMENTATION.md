## EditorCore 5-Layer Engine - Implementation Guide

### 📐 Architecture Overview

The EditorCore implements a sophisticated 5-layer rendering architecture to handle real-time collaborative editing with syntax highlighting, error detection, and collaborative cursors.

```
┌─────────────────────────────────────────────────────┐
│  EditorCore (Main Container)                        │
│  ├─ GutterPanel (Line Numbers + Error Icons)        │
│  └─ EditorScrollContainer                           │
│     └─ EditorLayers (Position: Relative Container)  │
│        ├─ Layer 1: DisplayLayer (z-10)              │
│        ├─ Layer 2: InputLayer (z-20)                │
│        ├─ Layer 3: OverlayLayer (z-30) [TODO]       │
│        └─ Layer 4: WidgetLayer (z-40) [TODO]        │
```

### 🎯 Component Breakdown

#### 1. **EditorCore.jsx** (Main Container)
- Manages state: `lines`, `diagnostics`, `scrollTop`, `cursorPosition`
- Handles scroll synchronization across all layers
- Listens for LSP diagnostics via Socket
- Emits content changes to collaborative engine (Yjs)
- Manages cursor position tracking for awareness updates

**Key Features:**
```javascript
// State management
const [lines, setLines] = useState([]);
const [diagnostics, setDiagnostics] = useState([]);
const [scrollTop, setScrollTop] = useState(0);
const [cursorPosition, setCursorPosition] = useState({ line: 0, column: 0 });

// Socket events
socket?.emit("editor:content-change", { fileId, projectId, content });
socket?.emit("editor:cursor-update", { fileId, projectId, line, column });
socket?.on("lsp:diagnostics", (data) => setDiagnostics(data.diagnostics));
```

#### 2. **GutterPanel.jsx** (Line Numbers + Error Icons)
- Displays line numbers (right-aligned)
- Shows error/warning icons for LSP diagnostics
- Synchronized scroll with content area
- Hoverable tooltips for diagnostic messages
- Fixed width (50px) with overflow hidden

**Key Features:**
```javascript
// Diagnostic severity colors
const getSeverityColor = (severity) => ({
  error: "text-red-500",
  warning: "text-amber-500",
  information: "text-blue-500",
});

// Line-to-diagnostic mapping
const diagnosticsByLine = useMemo(() => {
  const map = {};
  diagnostics.forEach((diag) => {
    const line = diag.range?.start?.line || 0;
    if (!map[line]) map[line] = [];
    map[line].push(diag);
  });
  return map;
}, [diagnostics]);
```

#### 3. **DisplayLayer.jsx** (Layer 1: z-index 10)
- Read-only, syntax-highlighted HTML
- Uses Tree-sitter WASM for highlighting (placeholder in implementation)
- Viewport-based rendering (will implement virtual scrolling)
- Updates when `editorContent` changes
- Positioned absolutely to overlay with InputLayer

**Current Status:** Basic placeholder with HTML escaping
**TODO:** Integrate Tree-sitter WASM for proper syntax highlighting

```javascript
// Placeholder highlighting (will be replaced with Tree-sitter)
const highlightedLines = useMemo(() => {
  return lines.map((line) => ({
    content: line,
    html: `<span class="text-slate-300">${escapedLine}</span>`
  }));
}, [lines]);
```

#### 4. **InputLayer.jsx** (Layer 2: z-index 20)
- `contentEditable="true"` div with `opacity: 0.01`
- Invisible but fully interactive (user types here)
- Cursor visible (caretColor: white)
- Handles:
  - Text input and paste events
  - Tab key → inserts 4 spaces
  - Auto-indentation on Enter
  - Cursor position tracking

**Key Features:**
```javascript
// Invisible but interactive
style={{
  opacity: 0.01,           // Nearly invisible
  caretColor: "white",     // Visible cursor
  whiteSpace: "pre-wrap",
  lineHeight: `${LINE_HEIGHT}px`
}}

// Tab handling
if (e.key === "Tab") {
  e.preventDefault();
  insertAtCursor("    "); // 4 spaces
}

// Auto-indent on Enter
const indentMatch = lineContent.match(/^\s*/);
const currentIndent = indentMatch ? indentMatch[0] : "";
```

#### 5. **EditorLayers.jsx** (Container for Layers 1-4)
- Position: relative container
- Wraps DisplayLayer and InputLayer
- Will contain OverlayLayer and WidgetLayer (TODO)
- Manages z-index stacking

#### 6. **EditorScrollContainer.jsx**
- Main scrollable container
- Captures scroll events
- Synchronizes scroll position across all layers
- Handles wheel events

**Key Implementation:**
```javascript
<div
  className="flex-1 overflow-auto bg-slate-950"
  onScroll={onScroll}  // Triggers sync for all layers
>
  {children}
</div>
```

### 🔄 Data Flow Diagram

#### Typing Flow
```
User types in InputLayer
  ↓
onInput event triggered
  ↓
calculateDelta(newContent)
  ↓
setEditorContent(newContent) [updates state]
  ↓
editorContent changes
  ↓
DisplayLayer re-renders with new HTML
  ↓
All layers synchronized
  ↓
Socket.emit('editor:content-change') [sync with Yjs]
  ↓
Other clients receive update via Yjs
  ↓
Their DisplayLayer updates
```

#### Scroll Synchronization
```
User scrolls (onScroll event)
  ↓
EditorScrollContainer captures scrollTop
  ↓
GutterPanel receives scrollTop
  ↓
GutterPanel uses paddingTop: -scrollTop to move content
  ↓
DisplayLayer and InputLayer receive scrollTop
  ↓
They synchronize scrollTop with refs
```

#### LSP Diagnostics
```
Backend debounces content (800ms)
  ↓
Sends to LSP server
  ↓
LSP analyzes code
  ↓
Backend receives diagnostics
  ↓
Socket.emit('lsp:diagnostics')
  ↓
EditorCore receives and sets diagnostics state
  ↓
GutterPanel re-renders error icons
  ↓
DisplayLayer (future) adds red squiggly underlines
```

### 📦 Dependencies

```javascript
// React hooks
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

// Socket integration
import { useSocket } from "../hooks/useSocket";

// Utilities (placeholder for Tree-sitter)
import { highlightCode } from "../utils/syntaxHighlighter";
```

### 🎨 CSS Constants

All components use consistent sizing:
```javascript
const LINE_HEIGHT = 20;      // pixels (match CSS line-height)
const GUTTER_WIDTH = 50;     // pixels
const TAB_SIZE = 4;          // spaces per tab
const CHAR_WIDTH = 8.4;      // monospace character width (approximate)
```

### 🔌 Socket Events Emitted

```javascript
// From EditorCore
socket?.emit("editor:content-change", {
  fileId: selectedFile?.id,
  projectId: selectedFile?.projectId,
  content: newContent
});

socket?.emit("editor:cursor-update", {
  fileId: selectedFile?.id,
  projectId: selectedFile?.projectId,
  line,
  column
});
```

### 🎯 Socket Events Listened To

```javascript
// LSP Diagnostics from Backend
socket?.on("lsp:diagnostics", (data) => {
  setDiagnostics(data.diagnostics || []);
});

// Future: Awareness updates (collaborative cursors)
socket?.on("awareness:update", (data) => {
  // Handle collaborative cursors
});
```

### ✅ Completed (Till Layer 2)

- ✅ EditorCore main container
- ✅ GutterPanel with line numbers and error icons
- ✅ DisplayLayer (basic HTML escaping, placeholder for Tree-sitter)
- ✅ InputLayer (contentEditable with tab/indent handling)
- ✅ EditorScrollContainer with scroll sync
- ✅ Socket integration for content changes
- ✅ LSP diagnostics display

### 📋 TODO (Layers 3-4)

1. **Layer 3: OverlayLayer**
   - Collaborative cursors (awareness.getStates())
   - Error squiggles (red wavy underlines)
   - Conflict markers (<<<<<<, ======, >>>>>>>)
   - Selection highlights (show other users' selections)

2. **Layer 4: WidgetLayer**
   - Autocomplete dropdown
   - Hover tooltips (LSP type info)
   - Line decorations (breakpoints, etc.)

3. **Tree-sitter Integration**
   - Load Tree-sitter WASM
   - Real-time syntax highlighting
   - Auto-completion suggestions
   - Local indentation detection

4. **Yjs Integration**
   - Connect to Yjs Y.Text
   - Apply remote updates to DisplayLayer
   - Handle collaborative edits with CRDT

5. **Performance Optimizations**
   - Virtual scrolling for large files
   - Debounce syntax highlighting
   - Memo-ize expensive calculations
   - Lazy-load LSP only when needed

### 🚀 Integration Points

The EditorCore is used in **EditorPage.jsx**:

```javascript
<EditorCore
  selectedFile={selectedFile}
  editorContent={editorContent}
  setEditorContent={setEditorContent}
/>
```

### 🧪 Testing Checklist

- [ ] Type character → InputLayer captures it
- [ ] Character appears in DisplayLayer immediately
- [ ] Scroll → GutterPanel and DisplayLayer sync
- [ ] Press Tab → Inserts 4 spaces
- [ ] Press Enter → Auto-indents to previous line's level
- [ ] Syntax error → Error icon appears in GutterPanel
- [ ] Hover error icon → Tooltip shows message
- [ ] Content changes → Socket emits to Yjs
- [ ] Cursor moves → Cursor position tracked
- [ ] File has errors → Diagnostics display correctly

---

**Next Priority:** Implement Layer 3 (OverlayLayer) for collaborative cursors and error squiggles.
