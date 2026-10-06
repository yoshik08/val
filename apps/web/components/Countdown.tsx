"use client";

import { useEffect, useState } from "react";

function fmt(seconds: number): string {
  const s = Math.max(0, seconds | 0);
  const h = (s / 3600) | 0;
  const m = ((s % 3600) / 60) | 0;
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

/** Countdown timer in JetBrains Mono, ticking every second. */
export default function Countdown({ expiresIn, prefix = "resets in" }: { expiresIn: number; prefix?: string }) {
  const [left, setLeft] = useState(expiresIn);

  useEffect(() => {
    setLeft(expiresIn);
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [expiresIn]);

  return (
    <span className="mono">
      {prefix} {fmt(left)}
    </span>
  );
}
