"use client";
// Keeps showing what was last rendered while `frozen`: React skips a subtree
// whose element is the same object, so the report sections are not redrawn
// when only the filter controls changed (the loading bar can paint at once).
// A different `keep` (e.g. another tab) always renders fresh.
import { useRef, type ReactNode } from "react";

export function Freeze({ frozen, keep, children }: { frozen: boolean; keep?: unknown; children: ReactNode }) {
  const last = useRef(children);
  const lastKeep = useRef(keep);
  if (!frozen || keep !== lastKeep.current) {
    last.current = children;
    lastKeep.current = keep;
  }
  return <>{last.current}</>;
}
