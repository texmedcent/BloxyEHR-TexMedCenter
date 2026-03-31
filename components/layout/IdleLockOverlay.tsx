"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { PRODUCT_NAME_SHORT } from "@/lib/branding";
import { Lock } from "lucide-react";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function IdleLockOverlay() {
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      setIsLocked(true);
      timeoutRef.current = null;
    }, IDLE_TIMEOUT_MS);
  }, []);

  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (isLocked) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    resetTimer();

    const handleActivity = () => {
      if (!isLocked) resetTimer();
    };

    const opts = { capture: true, passive: true };
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, handleActivity, opts);
    });

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, handleActivity, opts);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer, isLocked]);

  useEffect(() => {
    if (!isLocked) return;
    const id = setTimeout(() => overlayRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isLocked]);

  if (!isLocked) return null;

  return (
    <div
      ref={overlayRef}
      role="button"
      tabIndex={0}
      onClick={handleUnlock}
      onKeyDown={() => handleUnlock()}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-slate-900 dark:bg-slate-950 cursor-pointer select-none"
      aria-label="Session locked. Click to resume."
    >
      <div className="flex flex-col items-center gap-6 text-center px-6">
        <BehrLogo className="text-white" compact inverted />
        <div className="flex items-center gap-2 text-slate-400">
          <Lock className="h-5 w-5" />
          <span className="text-sm font-medium">
            Session locked due to inactivity
          </span>
        </div>
        <p className="text-slate-500 text-sm max-w-sm">
          Click anywhere or press any key to resume
        </p>
        <div className="mt-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-sm font-medium text-white ring-2 ring-white/20">
          Continue session
        </div>
      </div>
      <p className="absolute bottom-6 text-slate-600 text-xs">
        {PRODUCT_NAME_SHORT} · Protected health information
      </p>
    </div>
  );
}
