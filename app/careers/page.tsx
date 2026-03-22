import Link from "next/link";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { AnimateIn } from "@/components/ui/animate-in";
import {
  Heart,
  Stethoscope,
  Microscope,
  Building2,
  GraduationCap,
} from "lucide-react";

const DISCORD_URL = "https://discord.gg/J2ZVwSK5zy";

const CAREER_DOCKETS = [
  {
    title: "Nursing Careers",
    icon: Heart,
    description:
      "Nurses are at the heart of BloxyEHR, providing compassionate care and supporting patients across all departments.",
    docketType: "nursing",
  },
  {
    title: "Provider Careers",
    icon: Stethoscope,
    description:
      "Our providers — including physicians, physician assistants, and nurse practitioners — deliver expert care and lead clinical decision-making across specialties.",
    docketType: "provider",
  },
  {
    title: "Allied Health Careers",
    icon: Microscope,
    description:
      "Ancillary professionals play a key role in diagnostics, therapies, and support services that enhance patient outcomes and overall care.",
    docketType: "allied health",
  },
  {
    title: "Corporate Office Careers",
    icon: Building2,
    description:
      "Corporate Office professionals support BloxyEHR through leadership, administration, and system-wide operations that advance our mission.",
    docketType: "corporate office",
  },
  {
    title: "Student & Intern Opportunities",
    icon: GraduationCap,
    description:
      "BloxyEHR offers opportunities for students and interns to gain hands-on experience, develop professional skills, and explore careers in healthcare.",
    docketType: "student & intern",
  },
] as const;

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex h-16 w-full items-center justify-between bg-primary px-6 text-white shadow-md">
        <Link href="/" className="flex items-center">
          <BehrLogo compact inverted iconOnly />
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-white/95 transition-colors hover:text-white"
          >
            Home
          </Link>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-white/95 transition-colors hover:text-white"
          >
            BloxyEHR
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-slate-800 py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <AnimateIn>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
              Careers Forum
            </p>
            <h1 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Welcome to BloxyEHR Systems Careers!
            </h1>
            <p className="text-xl text-white/90">
              The Careers Forum serves as the central hub for employment opportunities across
              BloxyEHR. Each department maintains a dedicated docket where current openings
              will be posted and updated as needed.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* About the Careers Forum */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AnimateIn>
            <h2 className="mb-8 text-center text-3xl font-bold text-slate-900">
              About the Careers Forum
            </h2>
            <div className="space-y-6 text-lg text-slate-600">
              <p>
                Career Dockets include: Nursing Careers, Provider Careers (Physicians, PAs, NPs),
                Allied Health Careers, Corporate Office Careers, and Student & Intern Opportunities.
              </p>
              <p>
                Career postings are managed by the BloxyEHR Talent Management team. To ensure
                accuracy and consistency, only members with the designated Careers role are
                authorized to publish new opportunities.
              </p>
              <p>
                All staff and community members are encouraged to review the appropriate docket
                regularly for the latest updates.
              </p>
              <p className="font-medium text-slate-800">
                BloxyEHR is committed to fostering a professional, inclusive, and mission-driven
                workforce dedicated to delivering compassionate, patient-centered care.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Career Dockets */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <AnimateIn>
            <h2 className="mb-4 text-center text-3xl font-bold text-slate-900">
              Career Dockets
            </h2>
            <p className="mb-12 text-center text-lg text-slate-600">
              Each department maintains a dedicated docket for current openings. Check regularly for updates.
            </p>
          </AnimateIn>
          <div className="space-y-6">
            {CAREER_DOCKETS.map((docket, i) => (
              <AnimateIn key={docket.title} delay={i * 50}>
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <docket.icon className="mt-1 h-10 w-10 shrink-0 text-primary" />
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {docket.title}
                      </h3>
                      <p className="mt-2 text-slate-600">{docket.description}</p>
                      <p className="mt-3 text-sm text-slate-500">
                        Check this docket regularly for open {docket.docketType} positions. Only
                        authorized staff may post new opportunities here.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    View Docket
                  </Link>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <AnimateIn>
            <h2 className="mb-4 text-3xl font-bold text-white">
              Ready to Join Us?
            </h2>
            <p className="mb-8 text-lg text-white/90">
              Create an account to get started and connect with our team.
            </p>
            <Link
              href="/auth/sign-up"
              className="inline-flex h-12 items-center rounded-xl bg-accent px-8 text-base font-semibold text-slate-900 shadow-lg transition-all hover:bg-accent/90 hover:scale-105"
            >
              Create Account
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <BehrLogo compact iconOnly />
            </Link>
            <div className="flex gap-6 text-sm text-slate-600">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <Link href="/careers" className="hover:text-primary">
                Careers
              </Link>
              <Link href="/auth/login" className="hover:text-primary">
                BloxyEHR
              </Link>
            </div>
            <p className="text-sm text-slate-600">
              Powered by BloxyEHR · Roblox Healthcare
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
