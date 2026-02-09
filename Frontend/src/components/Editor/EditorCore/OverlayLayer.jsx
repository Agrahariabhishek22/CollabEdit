import CollaborativeCursors from "./CollaborativeCursors";

export default function OverlayLayer({
  awarenessStates,
  scrollTop,
  scrollLeft,
  layerHeight,
  // currentUserId,
}) {
  // console.log("[OverlayLayer]Scroll top and Scroll left", scrollLeft, scrollTop);
  
  return (
    <div
      className="absolute top-0 left-0 pointer-events-none overflow-hidden"
      style={{ 
        zIndex: 30,
        fontFamily: "'Fira Code', monospace",
        fontSize: "14px",
        transform: `translateY(-${scrollTop || 0}px) translateX(-${scrollLeft || 0}px)`,
        willChange: "transform",
        transition: "none",
        height:`${layerHeight}px`,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "2000px"
      }}
    >
      {/* 🟢 Component call - सब logic यहीं रहता है */}
      <CollaborativeCursors
        awarenessStates={awarenessStates}
        // currentUserId={currentUserId}
        scrollTop={scrollTop}
        scrollLeft={scrollLeft}
      />

      {/* Future के लिए baki components */}
    </div>
  );
}