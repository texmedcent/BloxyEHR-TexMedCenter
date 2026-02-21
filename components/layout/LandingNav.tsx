"use client";

import Link from "next/link";
import { BehrLogo } from "@/components/branding/BehrLogo";

interface LandingNavProps {
  children: React.ReactNode;
}

export function LandingNav({ children }: LandingNavProps) {
  return (
    <nav className="flex h-16 items-center justify-between rounded-xl border border-slate-200 dark:border-[hsl(var(--border))] bg-white/90 dark:bg-card/90 px-4 shadow-sm backdrop-blur">
      <Link href="/" className="group inline-flex items-center gap-3">
        <BehrLogo compact />
      </Link>
      {children}
    </nav>
  );
}
