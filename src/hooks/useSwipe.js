import { useRef } from "react";

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 48 } = {}) {
  const touch = useRef({ x: null, y: null });

  return {
    onTouchStart(e) {
      touch.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    },
    onTouchEnd(e) {
      const { x: sx, y: sy } = touch.current;
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      touch.current = { x: null, y: null };
      // Solo disparar si el movimiento horizontal domina y supera el umbral
      if (Math.abs(dx) < threshold || dy > Math.abs(dx)) return;
      if (dx < 0) onSwipeLeft?.(sy);
      else onSwipeRight?.(sy);
    },
    onTouchCancel() {
      touch.current = { x: null, y: null };
    },
  };
}
