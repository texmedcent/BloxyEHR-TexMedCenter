import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveClock } from "@/components/chart/LiveClock";
import { Activity, CalendarDays, FileText } from "lucide-react";
import { CheckInCard } from "@/components/patient/CheckInCard";
import { LogoutButton } from "@/components/logout-button";

export default async function PatientDashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;

  if (!claims?.sub) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .single();

  if (profile?.role && profile.role !== "patient") {
    redirect("/dashboard");
  }

  const { data: linkedPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("auth_user_id", claims.sub)
    .maybeSingle();

  const { count: appointmentCount } = linkedPatient?.id
    ? await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", linkedPatient.id)
    : { count: 0 };

  const { count: resultCount } = linkedPatient?.id
    ? await supabase
        .from("results")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", linkedPatient.id)
    : { count: 0 };

  const { data: activeCheckin } = await supabase
    .from("patient_checkins")
    .select("id, campus, status, checked_in_at")
    .eq("auth_user_id", claims.sub)
    .in("status", ["triage", "in_encounter"])
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              Patient Dashboard
            </h1>
            <LogoutButton />
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Welcome, {profile?.full_name || claims.email || "Patient"}
          </p>
          <div className="mt-2">
            <LiveClock />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#1a4d8c]" />
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{appointmentCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                Active Encounters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{resultCount ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <CheckInCard
          userId={claims.sub}
          fullName={profile?.full_name ?? null}
          email={claims.email}
          initialActiveCheckin={activeCheckin ?? null}
        />
      </div>
    </main>
  );
}
