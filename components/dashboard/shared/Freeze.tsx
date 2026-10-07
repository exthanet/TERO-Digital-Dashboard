"use client";
// Keeps showing what was last shown while `frozen`: React skips a subtree whose
// element is the same object, so the report sections are not redrawn when only
// the filter controls changed (the loading bar can paint at once).
// The kept copy is taken when a render is committed (not while rendering, which
// React may throw away), so it is always what was really on screen.
// A different `keep` (e.g. another tab) always renders fresh.
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function Freeze({ frozen, keep, children }: { frozen: boolean; keep?: unknown; children: ReactNode }) {
  const shown = useRef<{ children: ReactNode; keep: unknown } | null>(null);
  const out = frozen && shown.current && shown.current.keep === keep ? shown.current.children : children;
  useLayoutEffect(() => {
    shown.current = { children: out, keep };
  });
  return <>{out}</>;
}
