"use client";

import { useEffect } from "react";

/**
 * TouchProvider enables instantaneous CSS `:active` pseudo-class reactivity
 * across iOS WebKit (Safari, Chrome iOS) and Android Chrome by attaching a
 * passive touchstart event listener.
 */
export function TouchProvider() {
  useEffect(() => {
    const handleTouch = () => {};
    window.addEventListener("touchstart", handleTouch, { passive: true });
    return () => window.removeEventListener("touchstart", handleTouch);
  }, []);

  return null;
}
