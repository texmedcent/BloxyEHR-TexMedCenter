import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { AnimateIn } from "@/components/ui/animate-in";
import { HeroContent } from "@/components/landing/HeroContent";

const COMMUNITY_BG = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=1920&q=50";

export default async function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex h-16 w-full items-center justify-between bg-primary px-6 text-white shadow-md transition-all duration-300">
        <BehrLogo compact inverted />
        <div className="flex items-center gap-6">
          <Link href="/auth/login" className="text-sm font-medium text-white/95 transition-colors hover:text-white">
            BloxyEHR
          </Link>
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <div className="nav-auth flex gap-2 [&_a]:rounded-lg [&_a]:px-4 [&_a]:py-2 [&_a]:text-sm [&_a]:font-medium [&_a:first-child]:border [&_a:first-child]:border-white/70 [&_a:first-child]:bg-transparent [&_a:first-child]:text-white hover:[&_a:first-child]:bg-white/10 [&_a:last-child]:bg-accent [&_a:last-child]:text-slate-900 hover:[&_a:last-child]:bg-accent/90">
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[85vh] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1920&q=80"
          alt="Healthcare facility"
          fill
          className="object-cover object-center animate-fade-in"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/75 to-primary/85" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full max-w-6xl px-6">
            <HeroContent />
          </div>
        </div>
      </section>

      {/* Our Mission - prominent, welcoming */}
      <section className="relative min-h-[400px] overflow-hidden bg-primary py-20">
        <Image
          src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1920&q=80"
          alt=""
          fill
          className="object-cover object-center opacity-25"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-primary/90" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <AnimateIn>
            <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
              Our Mission
            </h2>
          <blockquote className="mb-6 text-2xl font-semibold text-accent sm:text-3xl animate-subtle-pulse">
            &ldquo;To improve health, elevate hope, and advance healing for all.&rdquo;
          </blockquote>
          <p className="text-lg leading-relaxed text-white/95">
            We are committed to delivering compassionate, high quality care to every patient,
            advancing medical innovation through research and education, and partnering with
            our communities to create a healthier future for all people—regardless of
            background or circumstance.
          </p>
          </AnimateIn>
        </div>
      </section>

      {/* About - cards with imagery */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <h2 className="mb-4 text-3xl font-bold text-primary">About BloxyEHR</h2>
            <p className="mb-12 max-w-2xl text-lg text-slate-600">
              We&apos;re proud to bring professional healthcare roleplay to Roblox—with a team
              that cares about you.
            </p>
          </AnimateIn>
          <div className="grid gap-8 lg:grid-cols-3">
            <AnimateIn delay={0}>
            <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80"
                  alt="Healthcare facility"
                  fill
                  className="object-cover transition-all duration-500 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <h3 className="absolute bottom-4 left-4 right-4 text-xl font-semibold text-white">
                  Our History
                </h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 leading-relaxed">
                  BloxyEHR was built to bring real-world EHR workflows to Roblox healthcare roleplay.
                  Modeled after Epic and modern hospital systems, it started as a way to replace
                  scattered Discord threads and forum posts with a single, structured platform.
                  Today it powers patient charts, clinical notes, orders, results, scheduling,
                  and pharmacy workflows—all in one place.
                </p>
              </div>
            </div>
            </AnimateIn>

            <AnimateIn delay={150}>
            <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1551076805-e1869033e561?w=600&q=80"
                  alt="Doctor and nurse providing care"
                  fill
                  className="object-cover transition-all duration-500 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <h3 className="absolute bottom-4 left-4 right-4 text-xl font-semibold text-white">
                  Why BloxyEHR Over Discord Charting?
                </h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 leading-relaxed">
                  Discord and forum charting is scattered across channels and threads—hard to search,
                  impossible to audit, and no real workflow. BloxyEHR gives you structured patient
                  charts, order entry with status tracking, signed progress notes, lab results,
                  eMAR, and scheduling—all in a single system built for clinical roleplay.
                </p>
              </div>
            </div>
            </AnimateIn>

            <AnimateIn delay={300}>
            <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="relative h-48 overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80"
                  alt="Doctor consultation with patient"
                  fill
                  className="object-cover transition-all duration-500 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <h3 className="absolute bottom-4 left-4 right-4 text-xl font-semibold text-white">
                  Support & Updates
                </h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 leading-relaxed">
                  We provide life-long updates and quick customer support. When you choose
                  BloxyEHR, you get ongoing feature improvements, migrations, and fixes—plus
                  responsive help when you need it. No lock-in, no surprise fees. We&apos;re here
                  to keep your hospital running smoothly.
                </p>
              </div>
            </div>
            </AnimateIn>
          </div>

          {/* Why teams choose BloxyEHR - subtle, supporting */}
          <AnimateIn delay={150}>
          <div className="mt-16 rounded-2xl border border-slate-200 bg-slate-50/50 p-8 transition-all duration-300 hover:shadow-md">
            <h3 className="mb-6 text-xl font-semibold text-primary">
              Powered by BloxyEHR
            </h3>
            <p className="mb-6 max-w-2xl text-slate-600">
              Our platform brings realistic charting, documentation, order entry, results,
              and medication workflows into one modern system.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                "Live patient charts with demographics, allergies, and vitals",
                "Clinical documentation with SOAP notes and ICD-10 coding",
                "Order entry with lab status flow",
                "Medication workflows with Med Rec and eMAR",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-slate-700">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          </AnimateIn>
        </div>
      </section>

      {/* Join Our Community - inviting CTA */}
      <section className="relative min-h-[350px] overflow-hidden bg-slate-100 py-20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${COMMUNITY_BG})` }}
        />
        <div className="relative mx-auto max-w-6xl px-6">
          <AnimateIn>
            <h2 className="mb-2 text-3xl font-bold text-primary">Join Our Community</h2>
            <p className="mb-10 text-lg text-slate-600">
              Connect with fellow team members, stay updated, and be part of something special.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="https://discord.gg/QpK3apKC"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center rounded-lg border-2 border-primary bg-white px-6 text-base font-semibold text-primary transition-all duration-300 hover:scale-105 hover:bg-primary/5"
              >
                Discord
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-primary/5 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-6">
              <BehrLogo compact />
            </div>
            <p className="text-sm text-slate-600">
              BloxyEHR · Roblox Healthcare
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}