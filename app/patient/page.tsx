import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveClock } from "@/components/chart/LiveClock";
import Link from "next/link";
import { Activity, CalendarDays, FileText, FlaskConical } from "lucide-react";
import { CheckInCard } from "@/components/patient/CheckInCard";
import { LogoutButton } from "@/components/logout-button";
import { PatientDashboardWorkspace } from "@/components/patient/PatientDashboardWorkspace";
import { AtriumHealthLogo } from "@/components/branding/AtriumHealthLogo";

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
    .select("id, mrn, first_name, last_name")
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

  const { data: encounters } = linkedPatient?.id
    ? await supabase
        .from("encounters")
        .select(
          "id, type, status, admit_date, discharge_date, final_diagnosis_description, disposition_type, discharge_instructions, return_precautions"
        )
        .eq("patient_id", linkedPatient.id)
        .order("admit_date", { ascending: false })
        .limit(50)
    : { data: [] };
  const encounterIds = (encounters || []).map((encounter) => encounter.id);
  const activeEncounterCount = (encounters || []).filter((encounter) => encounter.status === "active").length;

  const { data: encounterOrders } =
    encounterIds.length > 0
      ? await supabase
          .from("orders")
          .select("id, encounter_id, type, status, ordered_at, details")
          .in("encounter_id", encounterIds)
          .order("ordered_at", { ascending: false })
          .limit(120)
      : { data: [] };
  const procedures = (encounterOrders || []).filter((order) => order.type === "procedure");
  const orderIds = (encounterOrders || []).map((order) => order.id);

  const { data: encounterResults } =
    linkedPatient?.id && orderIds.length > 0
      ? await supabase
          .from("results")
          .select(
            "id, order_id, patient_id, type, status, reported_at, value, is_critical, released_to_patient, patient_release_hold"
          )
          .eq("patient_id", linkedPatient.id)
          .in("order_id", orderIds)
          .eq("released_to_patient", true)
          .eq("patient_release_hold", false)
          .order("reported_at", { ascending: false })
          .limit(120)
      : { data: [] };

  const { data: encounterNotes } =
    encounterIds.length > 0
      ? await supabase
          .from("clinical_notes")
          .select("id, encounter_id, type, content, signed_at, created_at, released_to_patient, patient_release_hold")
          .in("encounter_id", encounterIds)
          .eq("released_to_patient", true)
          .eq("patient_release_hold", false)
          .order("created_at", { ascending: false })
          .limit(120)
      : { data: [] };

  const { data: medOrders } = linkedPatient?.id
    ? await supabase
        .from("orders")
        .select(
          "id, encounter_id, status, ordered_at, details, is_controlled_substance, med_reconciled_at, med_reconciled_by_name, administration_frequency, next_due_at"
        )
        .eq("patient_id", linkedPatient.id)
        .eq("type", "med")
        .order("ordered_at", { ascending: false })
        .limit(120)
    : { data: [] };
  const medOrderIds = (medOrders || []).map((order) => order.id);
  const { data: medAdminLogs } =
    medOrderIds.length > 0
      ? await supabase
          .from("med_admin_log")
          .select("order_id, event_type, event_at, scheduled_for, was_overdue")
          .in("order_id", medOrderIds)
          .order("event_at", { ascending: false })
          .limit(300)
      : { data: [] };

  const { data: appointments } = linkedPatient?.id
    ? await supabase
        .from("appointments")
        .select("id, provider_id, slot_start, slot_end, type, status")
        .eq("patient_id", linkedPatient.id)
        .order("slot_start", { ascending: true })
        .limit(100)
    : { data: [] };
  const providerIds = Array.from(
    new Set((appointments || []).map((appointment) => appointment.provider_id).filter(Boolean))
  ) as string[];
  const { data: providerProfiles } =
    providerIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", providerIds)
      : { data: [] };
  const providerNameById = new Map((providerProfiles || []).map((profile) => [profile.id, profile.full_name]));
  const appointmentsWithNames = (appointments || []).map((appointment) => ({
    id: appointment.id,
    slot_start: appointment.slot_start,
    slot_end: appointment.slot_end,
    type: appointment.type,
    status: appointment.status,
    provider_name: appointment.provider_id ? providerNameById.get(appointment.provider_id) || null : null,
  }));

  const { data: patientTasks } = claims.sub
    ? await supabase
        .from("in_basket_tasks")
        .select("id, title, details, due_at, priority, status, created_at")
        .eq("owner_id", claims.sub)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const { data: activeCheckin } = await supabase
    .from("patient_checkins")
    .select("id, campus, status, checked_in_at, chief_complaint, acuity_level, pain_score, arrival_mode")
    .eq("auth_user_id", claims.sub)
    .in("status", ["triage", "in_encounter"])
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-background p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AtriumHealthLogo compact />
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                MyChart
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-sm font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link
                href="/patient/settings"
                className="text-sm font-medium text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors"
              >
                Settings
              </Link>
              <LogoutButton />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
            Hello! {profile?.full_name || claims.email || "Patient"}
          </p>
          {linkedPatient?.id && (
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">
              Patient: {linkedPatient.last_name}, {linkedPatient.first_name} (MRN: {linkedPatient.mrn})
            </p>
          )}
          <div className="mt-2">
            <LiveClock />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-slate-200 dark:border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
                <CalendarDays className="h-4 w-4 text-atrium-primary" />
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">{appointmentCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Active Encounters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">{activeEncounterCount}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
                <FileText className="h-4 w-4 text-atrium-primary" />
                Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">{resultCount ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
              <FlaskConical className="h-4 w-4 text-atrium-primary" />
              MyChart Clinical Workspace
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PatientDashboardWorkspace
              userId={claims.sub}
              patientId={linkedPatient?.id || null}
              encounters={encounters || []}
              results={(encounterResults || []).map((result) => ({
                id: result.id,
                order_id: result.order_id,
                encounter_id:
                  (encounterOrders || []).find((order) => order.id === result.order_id)?.encounter_id || null,
                type: result.type,
                status: result.status,
                reported_at: result.reported_at,
                value: result.value,
                is_critical: result.is_critical,
              }))}
              medOrders={medOrders || []}
              medAdminLogs={medAdminLogs || []}
              appointments={appointmentsWithNames}
              tasks={patientTasks || []}
              procedures={procedures || []}
              notes={encounterNotes || []}
            />
          </CardContent>
        </Card>

        <CheckInCard
          userId={claims.sub}
          fullName={profile?.full_name ?? null}
          email={claims.email}
          initialActiveCheckin={activeCheckin ?? null}
        />

        <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
          Atrium Health · Powered by BloxyEHR
        </footer>
      </div>
    </main>
  );
}
