import React from "react";
import DisplayLayer from "./DisplayLayer";
import InputLayer from "./InputLayer";
import OverlayLayer from "./OverlayLayer";
import WidgetLayer from "./WidgetLayer";

const LINE_HEIGHT = 20; // pixels

export default function EditorLayers({
  lines,
  editorContent,
  diagnostics,
  conflicts,
  awarenessStates,
  selections,
  cursorPosition,
  scrollTop,
  displayLayerRef,
  inputLayerRef,
  onInputChange,
  onCursorChange,
  selectedFile,
  currentUserId,
  autocomplete,
  hoverInfo,
}) {
  return (
    <div
      className="relative w-full h-full bg-slate-950"
      style={{
        lineHeight: `${LINE_HEIGHT}px`,
      }}
    >
      {/* Layer 1: DisplayLayer (z-index: 10) - Syntax highlighted, read-only */}
      <DisplayLayer
        lines={lines}
        fileLanguage={selectedFile?.extension}
        displayLayerRef={displayLayerRef}
      />

      {/* Layer 2: InputLayer (z-index: 20) - Transparent contentEditable where user types */}
      <InputLayer
        editorContent={editorContent}
        inputLayerRef={inputLayerRef}
        onInputChange={onInputChange}
        onCursorChange={onCursorChange}
        selectedFile={selectedFile}
      />

      {/* Layer 3: OverlayLayer (z-index: 30) - Cursors, errors, selections */}
      <OverlayLayer
        diagnostics={diagnostics}
        conflicts={conflicts}
        awarenessStates={awarenessStates}
        selections={selections}
        currentUserId={currentUserId}
        scrollTop={scrollTop}
      />

      {/* Layer 4: WidgetLayer (z-index: 40) - Autocomplete, tooltips */}
      <WidgetLayer
        autocomplete={autocomplete}
        hoverInfo={hoverInfo}
        cursorPosition={cursorPosition}
        scrollTop={scrollTop}
      />
    </div>
  );
}
