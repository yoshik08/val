"use client";

import { useEffect, useRef } from "react";

/**
 * Custom cursor: 5px accent dot + 30px ring with spring physics.
 * Only on fine pointers; disabled when prefers-reduced-motion is set.
 */
export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = -100, my = -100;
    let rx = -100, ry = -100, rvx = 0, rvy = 0, pulse = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx - 2.5}px,${my - 2.5}px)`;
    };
    const onDown = () => {
      pulse = 1;
    };
    const onEnter = () => document.body.classList.add("link-hover");
    const onLeave = () => document.body.classList.remove("link-hover");

    const loop = () => {
      rvx += (mx - rx) * 0.35;
      rvy += (my - ry) * 0.35;
      rvx *= 0.62;
      rvy *= 0.62;
      rx += rvx;
      ry += rvy;
      pulse *= 0.9;
      const s = document.body.classList.contains("link-hover") ? 24 : 15;
      ring.style.transform = `translate(${rx - s}px,${ry - s}px) scale(${(1 + pulse * 0.7).toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };

    // re-bind hover targets as the DOM changes (SPA navigations)
    const bind = () => {
      document.querySelectorAll("a, button, input, textarea, summary").forEach((el) => {
        if ((el as HTMLElement).dataset.cursorBound) return;
        (el as HTMLElement).dataset.cursorBound = "1";
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
      });
    };
    const obs = new MutationObserver(bind);
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mousedown", onDown);
    bind();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onDown);
      document.querySelectorAll("[data-cursor-bound]").forEach((el) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        delete (el as HTMLElement).dataset.cursorBound;
      });
      document.body.classList.remove("link-hover");
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
