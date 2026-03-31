"use client";

import Image from "next/image";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import {
  BRAND_HERO_FULL,
  POWERED_BY,
  PRODUCT_NAME,
} from "@/lib/branding";
import { LANDING_TAGLINE_PARTS } from "@/lib/landing-content";

const playfair = Playfair_Display({ subsets: ["latin"] });

export function HeroContent() {
  return (
    <div className={`mx-auto max-w-3xl text-center ${playfair.className}`}>
      {/* Lone star */}
      <div
        className="mb-5 flex justify-center text-amber-200/90 opacity-0 animate-fade-in-up fill-mode-forwards"
        aria-hidden
      >
        <svg viewBox="0 0 100 100" className="h-8 w-8 sm:h-10 sm:w-10">
          <path
            fill="currentColor"
            d="M50 4l12.2 37.6h39.5L68.4 60.9l12.2 37.6L50 73.2 19.4 98.5 31.6 60.9 8.3 41.6h39.5L50 4z"
          />
        </svg>
      </div>

      <div className="mb-8 flex justify-center opacity-0 animate-fade-in-up animate-delay-100 fill-mode-forwards">
        <Image
          src={BRAND_HERO_FULL}
          alt={`${PRODUCT_NAME} logo`}
          width={480}
          height={480}
          unoptimized
          priority
          className="max-h-44 w-auto max-w-[min(100%,20rem)] object-contain shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:max-h-52"
        />
      </div>

      <p className="mb-3 font-sans text-sm font-medium normal-case tracking-normal text-amber-100 opacity-0 animate-fade-in-up animate-delay-200 fill-mode-forwards">
        {POWERED_BY}
      </p>

      <div className="mb-8 space-y-1 opacity-0 animate-fade-in-up animate-delay-200 fill-mode-forwards">
        {LANDING_TAGLINE_PARTS.map((line) => (
          <p
            key={line}
            className="text-lg font-semibold italic tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-xl md:text-2xl"
          >
            {line}
          </p>
        ))}
      </div>

      <h1 className="mb-6 text-4xl font-bold leading-[1.15] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] opacity-0 animate-fade-in-up animate-delay-300 fill-mode-forwards sm:text-5xl md:text-6xl">
        {PRODUCT_NAME}
      </h1>

      <p className="mb-4 mx-auto max-w-xl text-lg leading-relaxed text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)] opacity-0 animate-fade-in-up animate-delay-400 fill-mode-forwards md:text-xl">
        Medicine, education, and community—rooted in the Texas Medical Center tradition.
        Step into a full hospital experience on Roblox with charting and workflows built for
        serious clinical roleplay.
      </p>

      <p className="mb-10 text-base text-white/80 opacity-0 animate-fade-in-up animate-delay-500 fill-mode-forwards">
        Charts, orders, documentation, and teamwork—{POWERED_BY}.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 opacity-0 animate-fade-in-up animate-delay-600 fill-mode-forwards">
        <Link
          href="/auth/login"
          className="inline-flex h-12 items-center rounded-md bg-white px-8 font-sans text-base font-semibold text-[#002868] shadow-lg transition hover:bg-amber-50 hover:shadow-xl"
        >
          Staff sign in
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex h-12 items-center rounded-md border-2 border-white/90 bg-white/10 px-8 font-sans text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
