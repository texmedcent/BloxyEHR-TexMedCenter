import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getRoleLandingPath } from "@/lib/roles";

export default async function Home() {
  if (hasEnvVars) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) {
      const userId = (data.claims as { sub?: string })?.sub;
      let role: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        role = profile?.role ?? null;
      }
      redirect(getRoleLandingPath(role));
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#f4f6f9]">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-gray-200 bg-white h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-bold text-xl text-[#1a4d8c]">
              BloxyEHR
            </Link>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-12 max-w-5xl p-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Electronic Hospital Records for Roblox
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            EPIC-style EHR system for hospital roleplay. Patient charts, clinical
            documentation, orders, and more.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="px-6 py-3 rounded-lg bg-[#1a4d8c] text-white font-medium hover:bg-[#1a4d8c]/90"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="px-6 py-3 rounded-lg border border-[#1a4d8c] text-[#1a4d8c] font-medium hover:bg-[#1a4d8c]/5"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
