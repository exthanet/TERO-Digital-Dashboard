"use client";
// Thin bar at the top edge while data loads or the report recalculates after a
// filter change. It runs without a percentage: neither Firestore nor the
// calculation reports progress, so any number would be made up.
import { useEffect, useState } from "react";
import { usePendingLoads } from "@/lib/loadingBar";

/** Tracked loads quicker than this (browser cache) never show the bar. */
const SHOW_AFTER_MS = 150;
/** How long the finished bar stays full before fading. */
const DONE_MS = 400;

/**
 * `busy` (opening load, recalculating) shows the bar at once: a heavy
 * calculation blocks timers, so a delay could hide it for the whole wait.
 */
export function TopLoadingBar({ busy = false }: { busy?: boolean }) {
  const loads = usePendingLoads() > 0;
  const [state, setState] = useState<"off" | "run" | "done">("off");

  useEffect(() => {
    if (busy) return setState("run");
    if (!loads) {
      setState((s) => (s === "run" ? "done" : s));
      return;
    }
    const t = setTimeout(() => setState("run"), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [busy, loads]);

  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setState("off"), DONE_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Drawn as running in the same render that turns `busy` on, before any effect.
  const shown = busy ? "run" : state;
  if (shown === "off") return null;
  return (
    <div className={`top-loading-bar ${shown}`} role="progressbar" aria-label="กำลังโหลดข้อมูล" aria-busy={shown === "run"}>
      <span />
    </div>
  );
}
