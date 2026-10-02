// Loads in flight, for the thin bar at the top of the page (TopLoadingBar).
// Wrap a load with track(); the bar shows while any tracked load is pending.
import { useSyncExternalStore } from "react";

let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Counts `p` as loading until it settles; returns `p` unchanged. */
export function track<T>(p: Promise<T>): Promise<T> {
  pending++;
  emit();
  const done = () => {
    pending--;
    emit();
  };
  p.then(done, done);
  return p;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePendingLoads(): number {
  return useSyncExternalStore(subscribe, () => pending, () => 0);
}
