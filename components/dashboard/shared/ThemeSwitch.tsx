"use client";
// Light (Ink & Indigo) / Black (the original navy look), per viewer in this browser.
// Only the pages listed in `active` use it for now (styles/theme-light.css).
import { useEffect, useState } from "react";

type Theme = "light" | "black";
const KEY = "tero-theme";

function readTheme(): Theme {
  try {
    return window.localStorage.getItem(KEY) === "light" ? "light" : "black";
  } catch {
    return "black";
  }
}

export function ThemeSwitch({ active }: { active: boolean }) {
  const [theme, setTheme] = useState<Theme>("black");
  // Read after mount so the server and the first browser render match.
  useEffect(() => {
    const t = window.setTimeout(() => setTheme(readTheme()), 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (active && theme === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [active, theme]);
  if (!active) return null;
  const pick = (t: Theme) => {
    setTheme(t);
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      // Private window or blocked storage: the choice lasts until reload.
    }
  };
  return (
    <div className="theme-switch" role="group" aria-label="โทนสี">
      <button type="button" className={theme === "light" ? "on" : ""} onClick={() => pick("light")} aria-pressed={theme === "light"}>
        Light
      </button>
      <button type="button" className={theme === "black" ? "on" : ""} onClick={() => pick("black")} aria-pressed={theme === "black"}>
        Black
      </button>
    </div>
  );
}
