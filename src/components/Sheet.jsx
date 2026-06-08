import { useRef } from "react";

const mu = "#6B7280",
  wh = "#FFFFFF";

// Bottom sheet reutilizable con gesto opcional de deslizar para cerrar.
// Props: onClose, title, children, swipeToClose.
export default function Sheet({ onClose, title, children, swipeToClose = false }) {
  const touch = useRef({ x: null, y: null });

  function handleTouchStart(e) {
    if (!swipeToClose) return;
    touch.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }

  function handleTouchEnd(e) {
    if (!swipeToClose) return;
    const { x: sx, y: sy } = touch.current;
    touch.current = { x: null, y: null };
    if (sx === null) return;
    const dy = e.changedTouches[0].clientY - sy;
    const dx = Math.abs(e.changedTouches[0].clientX - sx);
    if (dy > 60 && dy > dx) onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touch.current = { x: null, y: null }; }}
    >
      <div
        style={{
          background: wh,
          borderRadius: "20px 20px 0 0",
          padding: 24,
          width: "100%",
          maxHeight: "92dvh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          boxSizing: "border-box",
        }}
      >
        {swipeToClose && (
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#D1D5DB", margin: "-8px auto 16px" }} />
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              color: mu,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
