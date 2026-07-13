import { useCallback, useEffect, useRef, useState } from 'react';

const FRAME_MS = 33; // ~30fps is plenty for these vignettes

/** True when the sim should hold a still frame instead of animating. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useVisibility() {
  const [onScreen, setOnScreen] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rootRef = useCallback((el: HTMLElement | null) => {
    observerRef.current?.disconnect();
    if (!el) return;
    observerRef.current = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observerRef.current.observe(el);
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  return { onScreen, rootRef };
}

/**
 * Looping phase clock: returns `t ∈ [0,1)` advancing over `periodSeconds`, plus a `rootRef`
 * to attach to the sim's container. Pauses when the tab is hidden or the sim is off-screen;
 * under prefers-reduced-motion it holds a fixed representative frame.
 */
export function useSimClock(periodSeconds: number): { t: number; rootRef: (el: HTMLElement | null) => void } {
  const reduced = prefersReducedMotion();
  const [t, setT] = useState(reduced ? 0.4 : 0);
  const phase = useRef(reduced ? 0.4 : 0);
  const period = useRef(periodSeconds);
  period.current = Math.max(0.25, periodSeconds);
  const { onScreen, rootRef } = useVisibility();

  useEffect(() => {
    if (reduced || !onScreen) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.visibilityState === 'hidden') {
        last = now;
        return;
      }
      const dt = now - last;
      if (dt < FRAME_MS) return;
      last = now;
      phase.current = (phase.current + dt / 1000 / period.current) % 1;
      setT(phase.current);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, onScreen]);

  return { t, rootRef };
}

/**
 * Stepper clock for interactive physics sims: calls `step(dtSeconds)` every frame while
 * visible. The callback should read/write its own refs and set state when needed.
 */
export function useSimStepper(step: (dt: number) => void): { rootRef: (el: HTMLElement | null) => void } {
  const reduced = prefersReducedMotion();
  const { onScreen, rootRef } = useVisibility();
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (reduced || !onScreen) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.visibilityState === 'hidden') {
        last = now;
        return;
      }
      const dt = now - last;
      if (dt < FRAME_MS) return;
      last = now;
      stepRef.current(Math.min(dt, 100) / 1000); // clamp huge dts (tab switch back)
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, onScreen]);

  return { rootRef };
}
