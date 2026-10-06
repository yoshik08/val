"use client";

import { useEffect, useRef } from "react";

/**
 * Osu-style mouse trail: a canvas that draws fading line segments
 * following the cursor. Ported from yoshik.xyz (pokefx module).
 * Fine pointers only; disabled with prefers-reduced-motion.
 */
export default function Trail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);

    const accent = () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || "#3b5bfd";

    const trail: { x: number; y: number; t: number }[] = [];
    const onMove = (e: MouseEvent) => {
      trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (trail.length > 42) trail.shift();
    };
    document.addEventListener("mousemove", onMove);

    let raf = 0;
    const frame = () => {
      if (W !== window.innerWidth || H !== window.innerHeight) size();
      const now = performance.now();
      const col = accent();
      ctx.clearRect(0, 0, W, H);
      // drop segments older than 450ms, in place
      let w = 0;
      for (let i = 0; i < trail.length; i++) {
        if (now - trail[i].t < 450) trail[w++] = trail[i];
      }
      trail.length = w;

      if (trail.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let m = 1; m < trail.length; m++) {
          const p0 = trail[m - 1];
          const p1 = trail[m];
          const age = (now - p1.t) / 450;
          ctx.strokeStyle = col;
          ctx.globalAlpha = (1 - age) * 0.5;
          ctx.lineWidth = 0.6 + 3 * (1 - age);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        const head = trail[trail.length - 1];
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        pointerEvents: "none",
      }}
    />
  );
}
