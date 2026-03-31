import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveClock } from "@/components/chart/LiveClock";
import Link from "next/link";
import { CalendarDays, FileText, FlaskConical, Pill } from "lucide-react";
import { CheckInCard } from "@/components/patient/CheckInCard";
import { LogoutButton } from "@/components/logout-button";
import { PatientDashboardWorkspace } from "@/components/patient/PatientDashboardWorkspace";
import { PatientScheduleProvider } from "@/components/patient/PatientScheduleProvider";
import { PatientHeroActions } from "@/components/patient/PatientHeroActions";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { PRODUCT_NAME_SHORT } from "@/lib/branding";
import { CLINICAL_PROVIDER_ROLES } from "@/lib/roles";

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

  let { data: linkedPatient } = await supabase
    .from("patients")
    .select("id, mrn, first_name, last_name")
    .eq("auth_user_id", claims.sub)
    .maybeSingle();

  if (!linkedPatient) {
    const profileName = (profile?.full_name ?? "").trim();
    const emailLocal = (claims.email ?? "patient").split("@")[0];
    const nameParts = profileName ? profileName.split(/\s+/).filter(Boolean) : [];
    const fallbackFirst = nameParts[0] ?? emailLocal ?? "Patient";
    const fallbackLast =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Portal";
    const safeFirst = fallbackFirst.slice(0, 40) || "Patient";
    const safeLast = fallbackLast.slice(0, 40) || "Portal";
    const candidateMrn = `PT-${Date.now().toString().slice(-8)}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const { data: createdPatient } = await supabase
      .from("patients")
      .insert({
        auth_user_id: claims.sub,
        first_name: safeFirst,
        last_name: safeLast,
        dob: "2000-01-01",
        mrn: candidateMrn,
      })
      .select("id, mrn, first_name, last_name")
      .maybeSingle();

    if (createdPatient) {
      linkedPatient = createdPatient;
    } else {
      // If another request created it first (or auth_user_id already linked), hydrate the existing row.
      const { data: hydratedPatient } = await supabase
        .from("patients")
        .select("id, mrn, first_name, last_name")
        .eq("auth_user_id", claims.sub)
        .maybeSingle();
      linkedPatient = hydratedPatient ?? null;
    }
  }

  const { count: appointmentCount } = linkedPatient?.id
    ? await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", linkedPatient.id)
    : { count: 0 };

  const { data: encounters } = linkedPatient?.id
    ? await supabase
        .from("encounters")
        .select(
          "id, type, status, admit_date, discharge_date, final_diagnosis_description, disposition_type, discharge_instructions, return_precautions, assigned_to, assigned_to_name, supervising_attending"
        )
        .eq("patient_id", linkedPatient.id)
        .order("admit_date", { ascending: false })
        .limit(50)
    : { data: [] };

  const encounterList = encounters || [];
  const sortedByAdmit = [...encounterList].sort((a, b) => {
    const ta = a.admit_date ? new Date(a.admit_date).getTime() : 0;
    const tb = b.admit_date ? new Date(b.admit_date).getTime() : 0;
    return tb - ta;
  });
  const lastCompletedWithProvider = sortedByAdmit.find(
    (e) => e.status === "completed" || e.discharge_date
  );
  const followUpProviderId = lastCompletedWithProvider?.assigned_to ?? null;
  const followUpProviderName =
    lastCompletedWithProvider?.assigned_to_name ?? lastCompletedWithProvider?.supervising_attending ?? null;

  const encounterIds = encounterList.map((encounter) => encounter.id);
  const activeEncounterCount = encounterList.filter((encounter) => encounter.status === "active").length;

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

  const releasedResultsCount = (encounterResults || []).length;

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

  const activeMedCount = (medOrders || []).filter((m) => {
    const s = (m.status || "").toLowerCase();
    return s !== "discontinued" && s !== "cancelled";
  }).length;

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

  let patientPortalMessages:
    | {
        id: string;
        owner_id: string;
        owner_name: string | null;
        title: string;
        details: string | null;
        created_at: string;
        status: string;
        created_by: string | null;
        created_by_name: string | null;
      }[]
    | null = [];
  if (claims.sub) {
    const withHiddenFilter = await supabase
      .from("in_basket_tasks")
      .select("id, owner_id, owner_name, title, details, created_at, status, created_by, created_by_name, patient_hidden_at")
      .or(`created_by.eq.${claims.sub},owner_id.eq.${claims.sub}`)
      .is("patient_hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (withHiddenFilter.error) {
      const fallback = await supabase
        .from("in_basket_tasks")
        .select("id, owner_id, owner_name, title, details, created_at, status, created_by, created_by_name")
        .or(`created_by.eq.${claims.sub},owner_id.eq.${claims.sub}`)
        .order("created_at", { ascending: false })
        .limit(200);
      patientPortalMessages = fallback.data ?? [];
    } else {
      patientPortalMessages = (withHiddenFilter.data ?? []).map((row) => ({
        id: row.id,
        owner_id: row.owner_id,
        owner_name: row.owner_name,
        title: row.title,
        details: row.details,
        created_at: row.created_at,
        status: row.status,
        created_by: row.created_by,
        created_by_name: row.created_by_name,
      }));
    }
  }
  const filteredPortalMessages = (patientPortalMessages || [])
    .filter((msg) => {
      const title = (msg.title || "").toLowerCase();
      return title.startsWith("patient message:") || title.startsWith("provider reply:");
    })
    .slice(0, 100);

  const { data: clinicalProviders } = await supabase
    .from("profiles")
    .select("id, full_name, department, role")
    .in("role", CLINICAL_PROVIDER_ROLES)
    .order("full_name");

  const { data: careTeamRows } = linkedPatient?.id
    ? await supabase.from("patient_care_team").select("provider_id").eq("patient_id", linkedPatient.id)
    : { data: [] };
  const careTeamProviderIds = [...new Set((careTeamRows || []).map((r) => r.provider_id))];
  const { data: careTeamProfiles } =
    careTeamProviderIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, role").in("id", careTeamProviderIds)
      : { data: [] };
  const careTeamMembers = (careTeamProfiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
  }));

  const { data: activeCheckin } = await supabase
    .from("patient_checkins")
    .select("id, campus, status, checked_in_at, chief_complaint, acuity_level, pain_score, arrival_mode, care_setting")
    .eq("auth_user_id", claims.sub)
    .in("status", ["triage", "in_encounter"])
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
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
                MyChart
              </h1>
            </div>
            <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
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
          <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-slate-700 dark:text-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-2.5 py-1">
              <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium tabular-nums">{appointmentCount ?? 0}</span>
              <span className="text-slate-500 dark:text-muted-foreground">Appointments</span>
            </span>
            <span className="text-slate-300 dark:text-border px-0.5" aria-hidden>
              |
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-2.5 py-1">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium tabular-nums">{releasedResultsCount}</span>
              <span className="text-slate-500 dark:text-muted-foreground">Released results</span>
            </span>
            <span className="text-slate-300 dark:text-border px-0.5" aria-hidden>
              |
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-2.5 py-1">
              <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium tabular-nums">{activeMedCount}</span>
              <span className="text-slate-500 dark:text-muted-foreground">Active meds</span>
            </span>
            {activeEncounterCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-border px-0.5" aria-hidden>
                  |
                </span>
                <span className="text-xs text-slate-500">
                  {activeEncounterCount} active encounter{activeEncounterCount === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
          <div className="mt-2">
            <LiveClock />
          </div>
        </div>

        <PatientScheduleProvider patientId={linkedPatient?.id ?? null} providers={clinicalProviders || []}>
          <PatientHeroActions
            patientId={linkedPatient?.id ?? null}
            followUpProviderId={followUpProviderId}
            followUpProviderName={followUpProviderName}
          />

          <Card className="border-slate-200 dark:border-border">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
                <FlaskConical className="h-4 w-4 text-primary" />
                MyChart clinical workspace
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PatientDashboardWorkspace
                userId={claims.sub}
                patientId={linkedPatient?.id || null}
                currentPatientName={profile?.full_name || claims.email || "Patient"}
                providers={(clinicalProviders || []).map((provider) => ({
                  id: provider.id,
                  full_name: provider.full_name,
                  role: provider.role,
                  department: provider.department,
                }))}
                encounters={encounterList}
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
                careTeamMembers={careTeamMembers}
                portalMessages={filteredPortalMessages}
              />
            </CardContent>
          </Card>
        </PatientScheduleProvider>

        <CheckInCard
          userId={claims.sub}
          fullName={profile?.full_name ?? null}
          email={claims.email}
          initialActiveCheckin={activeCheckin ?? null}
        />

        <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
          {PRODUCT_NAME_SHORT}
        </footer>
      </div>
    </main>
  );
}
