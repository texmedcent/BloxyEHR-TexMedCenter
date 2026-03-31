import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Playfair_Display } from "next/font/google";
import { Heart, GraduationCap, MapPin, Stethoscope } from "lucide-react";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { POWERED_BY, PRODUCT_NAME, PRODUCT_NAME_SHORT } from "@/lib/branding";
import {
  DISCORD_INVITE_URL,
  LANDING_MISSION_STORY,
  LANDING_TAGLINE,
  LANDING_TAGLINE_PARTS,
  ROBLOX_COMMUNITY_URL,
} from "@/lib/landing-content";
import { AnimateIn } from "@/components/ui/animate-in";
import { HeroContent } from "@/components/landing/HeroContent";
import { BRAND_HERO_SKY } from "@/lib/branding";

const display = Playfair_Display({ subsets: ["latin"] });

const PILLARS = [
  {
    title: "Advancing Health",
    line: LANDING_TAGLINE_PARTS[0],
    body: "Compassionate, high-quality care for every patient—charting, orders, and safety workflows modeled on real hospital practice.",
    icon: Heart,
  },
  {
    title: "Educating Leaders",
    line: LANDING_TAGLINE_PARTS[1],
    body: "Documentation, teaching cases, and structured handoffs that help your team learn medicine by doing it together.",
    icon: GraduationCap,
  },
  {
    title: "Serving Texas",
    line: LANDING_TAGLINE_PARTS[2],
    body: "A Roblox community rooted in the Texas Medical Center spirit—serving patients and each other with pride.",
    icon: MapPin,
  },
] as const;

export default async function Home() {
  return (
    <main className="min-h-screen bg-[#f5f0e8] text-slate-900 antialiased">
      {/* Texas flag accent */}
      <div className="h-1.5 w-full bg-[#002868]" aria-hidden />
      <div className="h-1 w-full bg-white" aria-hidden />
      <div className="h-1 w-full bg-[#BF0A30]" aria-hidden />

      {/* Nav */}
      <nav className="sticky top-0 z-50 flex h-[4.25rem] w-full items-center justify-between border-b border-white/10 bg-[#002868] px-4 shadow-lg sm:px-6">
        <BehrLogo compact inverted fullName />
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-white/95 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <div className="nav-auth flex gap-2 [&_a]:rounded-md [&_a]:px-3 [&_a]:py-2 [&_a]:text-sm [&_a]:font-medium sm:[&_a]:px-4 [&_a:first-child]:border [&_a:first-child]:border-white/60 [&_a:first-child]:bg-transparent [&_a:first-child]:text-white hover:[&_a:first-child]:bg-white/10 [&_a:last-child]:bg-amber-50 [&_a:last-child]:text-[#002868] hover:[&_a:last-child]:bg-white">
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          )}
        </div>
      </nav>

      {/* Hero — Houston TMC night panorama; overlays keep copy readable on dark sky + field */}
      <section className="relative min-h-[88vh] overflow-hidden">
        <Image
          src={BRAND_HERO_SKY}
          alt=""
          fill
          className="object-cover object-[center_38%] sm:object-[center_42%]"
          priority
          sizes="100vw"
        />
        {/* Night: cool navy wash + brand blue in upper sky; stronger base for contrast on track/field */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/55 via-[#0c1929]/50 to-[#020617]/88"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_15%,rgba(65,147,189,0.22),transparent_58%)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-[0.25] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E')]"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-[88vh] items-center justify-center py-16">
          <div className="w-full max-w-6xl px-4 sm:px-6">
            <HeroContent />
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="relative border-y border-amber-900/10 bg-[#ebe4d8] py-20">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1/3 bg-gradient-to-r from-amber-200/20 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AnimateIn>
            <p
              className={`mb-2 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#8b2942]`}
            >
              What we stand for
            </p>
            <h2
              className={`${display.className} mb-12 text-center text-3xl font-bold text-[#002868] sm:text-4xl`}
            >
              {LANDING_TAGLINE}
            </h2>
          </AnimateIn>
          <div className="grid gap-8 md:grid-cols-3">
            {PILLARS.map(({ title, line, body, icon: Icon }, i) => (
              <AnimateIn key={title} delay={i * 100}>
                <article className="group relative h-full overflow-hidden rounded-xl border border-[#002868]/10 bg-white/80 p-8 shadow-sm backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-4 inline-flex rounded-lg bg-[#4193bd]/10 p-3 text-[#002868]">
                    <Icon className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <h3
                    className={`${display.className} mb-1 text-2xl font-bold text-[#002868]`}
                  >
                    {title}
                  </h3>
                  <p className="mb-3 text-sm font-medium italic text-slate-500">{line}</p>
                  <p className="text-slate-600 leading-relaxed">{body}</p>
                </article>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Mission narrative */}
      <section className="relative overflow-hidden bg-[#002868] py-20 text-white">
        <div className="absolute -right-20 -top-20 h-64 w-64 text-white/5">
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
            <path
              fill="currentColor"
              d="M50 4l12.2 37.6h39.5L68.4 60.9l12.2 37.6L50 73.2 19.4 98.5 31.6 60.9 8.3 41.6h39.5L50 4z"
            />
          </svg>
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <AnimateIn>
            <Stethoscope
              className="mx-auto mb-6 h-10 w-10 text-amber-200/90"
              strokeWidth={1.5}
            />
            <h2
              className={`${display.className} mb-8 text-3xl font-bold leading-tight sm:text-4xl`}
            >
              Building a community dedicated to medicine
            </h2>
            <p className="text-lg leading-relaxed text-white/90 md:text-xl">
              {LANDING_MISSION_STORY}
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Clinical platform */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AnimateIn>
            <h2
              className={`${display.className} mb-4 text-center text-3xl font-bold text-[#002868] sm:text-4xl`}
            >
              Clinical tools for serious roleplay
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-slate-600">
              {PRODUCT_NAME} brings Epic-style structure to Roblox hospitals—one system for
              charts, orders, results, and teamwork. {POWERED_BY}.
            </p>
          </AnimateIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Live charts: demographics, allergies, vitals",
              "SOAP notes & ICD-style documentation",
              "Orders & lab workflow with real status",
              "eMAR, scheduling, pharmacy, and more",
            ].map((item, i) => (
              <AnimateIn key={item} delay={i * 80}>
                <div className="h-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#4193bd]/15 text-sm font-bold text-[#002868]">
                    {i + 1}
                  </span>
                  <p className="text-slate-700 leading-snug">{item}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="relative border-t border-amber-900/10 bg-[#ebe4d8] py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%23002868' d='M50 5l11 34h36l-29 21 11 35-29-21-29 21 11-35-29-21h36z'/%3E%3C/svg%3E")`,
            backgroundSize: "120px 120px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <AnimateIn>
            <h2
              className={`${display.className} mb-3 text-center text-3xl font-bold text-[#002868] sm:text-4xl`}
            >
              Join the community
            </h2>
            <p className="mb-10 text-center text-lg text-slate-600">
              Meet your crew on Roblox and stay in touch on Discord—whether you&apos;re on the
              floor or off shift.
            </p>
          </AnimateIn>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
            <AnimateIn delay={0}>
              <Link
                href={ROBLOX_COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[3.5rem] items-center justify-center rounded-lg border-2 border-[#002868] bg-[#002868] px-8 text-center text-base font-semibold text-white shadow-md transition hover:bg-[#003a7a] hover:shadow-lg"
              >
                Roblox community
              </Link>
            </AnimateIn>
            <AnimateIn delay={100}>
              <Link
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[3.5rem] items-center justify-center rounded-lg border-2 border-[#5865F2] bg-[#5865F2] px-8 text-center text-base font-semibold text-white shadow-md transition hover:bg-[#4752C4] hover:shadow-lg"
              >
                Discord server
              </Link>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#1a1614] py-10 text-[#e8e0d5]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <BehrLogo compact inverted fullName />
          <p className="text-center text-sm text-[#c4b8a8]">
            {PRODUCT_NAME_SHORT} · Roblox healthcare · {LANDING_TAGLINE}
          </p>
        </div>
      </footer>
    </main>
  );
}
