"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";

const MIN_VISIBLE_MS = 1400;

export function LoadingOverlay() {
  const { progress, active } = useProgress();
  const [mountedAt] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (active) return;
    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const timer = setTimeout(() => setDismissed(true), remaining);
    return () => clearTimeout(timer);
  }, [active, mountedAt]);

  const displayProgress = Math.max(progress, dismissed ? 100 : 0);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
        dismissed ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-amber-200/80">
          Powering up the factory
        </p>
        <div className="h-px w-48 overflow-hidden bg-white/10">
          <div
            className="h-full bg-amber-400 transition-[width] duration-200"
            style={{ width: `${Math.round(displayProgress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
