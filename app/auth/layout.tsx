import Link from "next/link";
import { AtriumHealthLogo } from "@/components/branding/AtriumHealthLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center bg-gradient-to-br from-atrium-primary/95 via-atrium-primary to-slate-800 p-6 md:p-10">
      {/* Subtle pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <Link
        href="/"
        className="absolute left-6 top-6 text-sm font-medium text-white/90 transition-colors hover:text-white"
      >
        ← Back to home
      </Link>
      <Link href="/" className="mb-8 flex justify-center">
        <AtriumHealthLogo compact variant="white" iconOnly />
      </Link>
      <div className="relative w-full max-w-sm">{children}</div>
      <p className="mt-8 text-center text-xs text-white/60">
        Powered by BloxyEHR
      </p>
    </div>
  );
}
