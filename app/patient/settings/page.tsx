import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PatientAccountForm } from "@/components/patient/PatientAccountForm";
import { AtriumHealthLogo } from "@/components/branding/AtriumHealthLogo";
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AtriumHealthLogo compact />
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                MyChart Settings
              </h1>
            </div>
            <div className="flex items-center gap-2">
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
