"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * TouchProvider enables:
 * 1. Instantaneous CSS `:active` pseudo-class reactivity across iOS WebKit and Android Chrome
 *    by attaching a passive `touchstart` listener.
 * 2. Immediate (<16ms) visual pending feedback (`data-nav-pending="true"`) and a top navigation
 *    progress indicator whenever an internal `<Link>` / `<a href="/...">` or GET search form is triggered.
 */
export function TouchProvider() {
  const pathname = usePathname();
  const [navPendingFromPath, setNavPendingFromPath] = useState<string | null>(
    null
  );
  const isNavigating =
    navPendingFromPath !== null && navPendingFromPath === pathname;

  // Clear external DOM data-nav-pending attribute whenever pathname changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document
        .querySelectorAll('[data-nav-pending="true"]')
        .forEach((el) => el.removeAttribute("data-nav-pending"));
    }
  }, [pathname]);

  useEffect(() => {
    const handleTouch = () => {};
    window.addEventListener("touchstart", handleTouch, { passive: true });

    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPending = () => {
      setNavPendingFromPath(null);
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      document
        .querySelectorAll('[data-nav-pending="true"]')
        .forEach((el) => el.removeAttribute("data-nav-pending"));
    };

    const startPending = (anchor?: HTMLElement | null) => {
      document
        .querySelectorAll('[data-nav-pending="true"]')
        .forEach((el) => el.removeAttribute("data-nav-pending"));
      if (anchor) {
        anchor.setAttribute("data-nav-pending", "true");
      }
      setNavPendingFromPath(window.location.pathname);
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(clearPending, 4000);
    };

    const handleClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute("href");
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      try {
        const url = new URL(rawHref, window.location.origin);
        if (url.origin !== window.location.origin) return;

        const currentFull = window.location.pathname + window.location.search;
        const targetFull = url.pathname + url.search;
        if (currentFull === targetFull) return;

        startPending(anchor);
      } catch {
        // ignore malformed hrefs
      }
    };

    const handleSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const method = (form.getAttribute("method") || "GET").toUpperCase();
      if (method === "GET" && form.getAttribute("action")?.startsWith("/")) {
        startPending(form);
      }
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      window.removeEventListener("touchstart", handleTouch);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      role="progressbar"
      aria-label="Page navigation in progress"
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-orange-100 overflow-hidden pointer-events-none"
    >
      <div className="h-full w-2/3 bg-sparehub-orange animate-pulse rounded-r-full" />
    </div>
  );
}
