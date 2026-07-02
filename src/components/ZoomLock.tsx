"use client";

import { useEffect } from "react";

const zoomKeys = new Set(["+", "=", "-", "_", "0"]);

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, a, input, textarea, select, [role='button']"))
  );
}

export default function ZoomLock() {
  useEffect(() => {
    let lastTouchEnd = 0;

    const prevent = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };

    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };

    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300 && !isInteractiveTarget(e.target) && e.cancelable) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    const preventWheelZoom = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.cancelable) e.preventDefault();
    };

    const preventKeyboardZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && zoomKeys.has(e.key)) e.preventDefault();
    };

    document.addEventListener("touchmove", preventMultiTouch, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchend", preventDoubleTap, {
      passive: false,
      capture: true,
    });
    window.addEventListener("wheel", preventWheelZoom, { passive: false });
    window.addEventListener("keydown", preventKeyboardZoom, true);
    window.addEventListener("gesturestart", prevent, { passive: false });
    window.addEventListener("gesturechange", prevent, { passive: false });
    window.addEventListener("gestureend", prevent, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventMultiTouch, true);
      document.removeEventListener("touchend", preventDoubleTap, true);
      window.removeEventListener("wheel", preventWheelZoom);
      window.removeEventListener("keydown", preventKeyboardZoom, true);
      window.removeEventListener("gesturestart", prevent);
      window.removeEventListener("gesturechange", prevent);
      window.removeEventListener("gestureend", prevent);
    };
  }, []);

  return null;
}
