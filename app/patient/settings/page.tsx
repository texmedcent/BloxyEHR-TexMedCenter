import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PatientAccountForm } from "@/components/patient/PatientAccountForm";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { LogoutButton } from "@/components/logout-button";

export default async function PatientSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;

  if (!claims?.sub) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", claims.sub)
    .single();

  if (profile?.role && profile.role !== "patient") {
    redirect("/dashboard");
  }

  const email = profile?.email ?? claims.email ?? null;

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-background p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4 sm:justify-start">
              <BehrLogo
                compact
                wordmarkOnly
                emphasizeShortName
                wordmarkAlign="responsive"
              />
              <h1 className="text-2xl font-semibold text-center text-slate-900 dark:text-foreground sm:text-left">
                MyChart Settings
              </h1>
            </div>
            <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
              <Link
                href="/patient"
                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Back to MyChart"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>

        <PatientAccountForm
          userId={claims.sub}
          initialFullName={profile?.full_name ?? null}
          email={email ?? null}
        />
      </div>
    </main>
  );
}
