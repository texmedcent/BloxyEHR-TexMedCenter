import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { LandingNav } from "@/components/layout/LandingNav";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getRoleLandingPath } from "@/lib/roles";
import { BehrLogo } from "@/components/branding/BehrLogo";

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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 dark:from-background dark:to-[hsl(222,47%,14%)] text-slate-900 dark:text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-4 sm:px-6">
        <LandingNav>
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <Suspense>
              <AuthButton />
            </Suspense>
          )}
        </LandingNav>

        <section className="mt-8 grid flex-1 items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <BehrLogo />

            <div className="flex justify-center lg:justify-start">
              <div className="inline-flex items-center rounded-full border border-[#1a4d8c]/15 bg-[#1a4d8c]/5 px-3 py-1 text-xs font-semibold text-[#1a4d8c]">
                TRUSTED BY ATRIUM HEALTH
              </div>
            </div>

            <h1 className="text-3xl font-black leading-tight sm:text-4xl">
              The immersive EHR platform for
              <span className="text-[#1a4d8c]"> Roblox healthcare teams</span>.
            </h1>

            <p className="max-w-2xl text-lg text-slate-600 dark:text-muted-foreground">
              BEHR brings realistic charting, documentation, order entry, results,
              and medication workflows into one modern system designed for roleplay hospitals.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex h-11 items-center rounded-md border border-slate-300 dark:border-input bg-white dark:bg-card px-5 text-sm font-semibold text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted"
              >
                View Interactive Demo
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center rounded-md bg-[#1a4d8c] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#1a4d8c]/90"
              >
                Launch BEHR
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex h-11 items-center rounded-md border border-[#1a4d8c]/30 bg-white px-5 text-sm font-semibold text-[#1a4d8c] hover:bg-[#1a4d8c]/5"
              >
                Create Account
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-[hsl(var(--border))] bg-white dark:bg-card p-5 shadow-lg shadow-blue-100/60 dark:shadow-none">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Why teams choose BEHR
            </h2>
            <div className="space-y-3">
              {[
                "Live patient chart with demographics, allergies, vitals, and encounters",
                "Clinical documentation with SOAP notes, signatures, DDx, and ICD-10 coding",
                "Order Entry with lab status flow: Pending to Preliminary to Final",
                "Medication workflows with Med Rec, eMAR logs, and controlled-substance code checks",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-slate-200 dark:border-[hsl(var(--border))] bg-slate-50 dark:bg-muted px-3 py-2 text-sm text-slate-700 dark:text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
