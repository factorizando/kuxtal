import { useRef } from "react";

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 48,
  fromRightEdge = false,
  edgeWidth = 44,
} = {}) {
  const touch = useRef({ x: null, y: null, validEdge: true });

  return {
    onTouchStart(e) {
      const startX = e.touches[0].clientX;
      touch.current = {
        x: startX,
        y: e.touches[0].clientY,
        validEdge: !fromRightEdge || startX >= window.innerWidth - edgeWidth,
      };
    },
    onTouchEnd(e) {
      const { x: sx, y: sy, validEdge } = touch.current;
      if (sx === null) return;
      touch.current = { x: null, y: null, validEdge: true };
      if (!validEdge) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      // Solo disparar si el movimiento horizontal domina y supera el umbral
      if (Math.abs(dx) < threshold || dy > Math.abs(dx)) return;
      if (dx < 0) onSwipeLeft?.(sy);
      else onSwipeRight?.(sy);
    },
    onTouchCancel() {
      touch.current = { x: null, y: null, validEdge: true };
    },
  };
}
