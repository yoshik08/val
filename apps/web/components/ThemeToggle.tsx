"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.theme || "light";
  });

  useEffect(() => {
    const el = document.documentElement;
    const stored = (() => {
      try {
        return localStorage.getItem("val-theme");
      } catch {
        return null;
      }
    })();
    const initial =
      stored ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    el.dataset.theme = initial;
    setTheme(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("val-theme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      title="toggle theme"
      aria-label="toggle theme"
      suppressHydrationWarning
    >
      {theme === "dark" ? "◑" : "◐"}
    </button>
  );
}
