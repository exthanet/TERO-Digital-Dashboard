"use client";
// Motion for the platform boards: numbers that count up and a loading skeleton.
// Everything follows the computer's "reduce motion" setting.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

/** False when the computer asks for less motion. */
export function useMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** A number that counts from its last value to the new one (0.7 s, ease-out). */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const motion = useMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!motion) return;
    const a = from.current;
    const start = performance.now();
    let id = 0;
    const finish = () => {
      cancelAnimationFrame(id);
      from.current = value;
      setShown(value);
    };
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    // Browsers pause animation frames in a hidden tab: the final number must show anyway.
    const done = window.setTimeout(finish, document.hidden ? 0 : 800);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(done);
    };
  }, [value, motion]);
  return <>{format(motion ? shown : value)}</>;
}

/** Grey blocks in the shape of what is loading. */
export function Skeleton({ lines = 3, height = 120 }: { lines?: number; height?: number }) {
  return (
    <div className="ps-skel" aria-hidden>
      <span style={{ height }} />
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
