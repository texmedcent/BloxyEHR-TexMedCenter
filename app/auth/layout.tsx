import Link from "next/link";
import Image from "next/image";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { BRAND_HERO_SKY, POWERED_BY } from "@/lib/branding";
import { LANDING_TAGLINE } from "@/lib/landing-content";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden p-6 pt-14 md:p-10 md:pt-16">
      <Image
        src={BRAND_HERO_SKY}
        alt=""
        fill
        className="object-cover object-[center_38%] sm:object-[center_42%]"
        priority
        sizes="100vw"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#002868]/70 via-[#0f172a]/82 to-[#0a1628]/95"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(65,147,189,0.18),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E')]"
        aria-hidden
      />

      {/* Texas flag accent — same as landing */}
      <div className="absolute left-0 right-0 top-0 z-40 flex h-1.5 w-full shadow-sm" aria-hidden>
        <div className="h-full flex-[3] bg-[#002868]" />
        <div className="h-full flex-1 bg-white" />
        <div className="h-full flex-[2] bg-[#BF0A30]" />
      </div>

      <Link
        href="/"
        className="absolute left-4 top-9 z-40 text-sm font-medium text-white/90 transition-colors hover:text-white md:left-8 md:top-10"
      >
        ← Back to home
      </Link>

      <div className="relative z-30 flex w-full max-w-sm flex-col items-center">
        <Link href="/" className="mb-8 flex justify-center drop-shadow-lg">
          <BehrLogo compact inverted />
        </Link>
        {children}
        <div className="mt-8 max-w-xs text-center">
          <p className="font-serif text-xs font-medium italic leading-relaxed text-white/85">
            {LANDING_TAGLINE}
          </p>
          <p className="mt-2 text-xs text-white/55">{POWERED_BY}</p>
        </div>
      </div>
    </div>
  );
}
