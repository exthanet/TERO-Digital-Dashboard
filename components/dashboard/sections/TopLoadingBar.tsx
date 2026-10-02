"use client";
// Thin bar at the top edge while data is loading. It runs without a percentage:
// Firestore does not report progress, so any number would be made up.
import { useEffect, useState } from "react";
import { usePendingLoads } from "@/lib/loadingBar";

/** Loads quicker than this (browser cache) never show the bar. */
const SHOW_AFTER_MS = 150;
/** How long the finished bar stays full before fading. */
const DONE_MS = 400;

export function TopLoadingBar({ busy = false }: { busy?: boolean }) {
  const active = usePendingLoads() > 0 || busy;
  const [state, setState] = useState<"off" | "run" | "done">("off");

  useEffect(() => {
    if (!active) {
      setState((s) => (s === "run" ? "done" : s));
      return;
    }
    const t = setTimeout(() => setState("run"), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [active]);

  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setState("off"), DONE_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "off") return null;
  return (
    <div className={`top-loading-bar ${state}`} role="progressbar" aria-label="กำลังโหลดข้อมูล" aria-busy={state === "run"}>
      <span />
    </div>
  );
}
