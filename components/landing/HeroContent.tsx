"use client";

import Link from "next/link";

export function HeroContent() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent/95 opacity-0 animate-fade-in-up animate-delay-100 fill-mode-forwards">
        Powered by BloxyEHR · Roblox Healthcare
      </p>
      <h1 className="mb-6 text-4xl font-bold leading-tight text-white opacity-0 animate-fade-in-up animate-delay-200 fill-mode-forwards sm:text-5xl lg:text-6xl">
        Welcome to <span className="text-accent">BloxyEHR</span>
      </h1>
      <p className="mb-6 text-xl leading-relaxed text-white/95 opacity-0 animate-fade-in-up animate-delay-300 fill-mode-forwards">
        Where excellence meets compassion. We&apos;re here to deliver exceptional care
        and build a healthier community—together. Your journey begins here.
      </p>
      <p className="mb-12 text-lg text-white/90 opacity-0 animate-fade-in-up animate-delay-400 fill-mode-forwards">
        The immersive EHR platform powering our Roblox healthcare teams. Realistic
        charting, documentation, and workflows designed for roleplay hospitals.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 opacity-0 animate-fade-in-up animate-delay-500 fill-mode-forwards">
        <Link
          href="/auth/login"
          className="inline-flex h-12 items-center rounded-xl bg-accent px-8 text-base font-semibold text-slate-900 shadow-lg shadow-black/20 transition-all duration-300 hover:scale-105 hover:bg-accent/90 hover:shadow-xl hover:shadow-black/25"
        >
          Access BloxyEHR
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex h-12 items-center rounded-xl border-2 border-white/80 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/15 hover:border-white"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}
