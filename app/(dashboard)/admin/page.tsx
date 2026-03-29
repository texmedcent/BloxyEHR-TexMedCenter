import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionAndUser } from "@/lib/supabase/server";
import {
  AlertTriangle,
  Pill,
  ShieldAlert,
  Inbox,
  Building2,
  Settings,
  CalendarClock,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isHospitalManager } from "@/lib/roles";
import { AdminLoaSection } from "@/components/admin/AdminLoaSection";
import { AdminQuickLinksSection } from "@/components/admin/AdminQuickLinksSection";
import { AdminFeedbackSection } from "@/components/admin/AdminFeedbackSection";
import { AdminHoursSection } from "@/components/admin/AdminHoursSection";
import { AdminShiftsSection } from "@/components/admin/AdminShiftsSection";
import { AdminForceEndEncountersSection } from "@/components/admin/AdminForceEndEncountersSection";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";

function getWeekStartIso(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function AdminPage() {
  const { supabase, userId } = await getSessionAndUser();

  if (!userId) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!isHospitalManager(profile?.role)) {
    redirect("/dashboard");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { count: activeEncounterCount },
    { count: todayAppointmentCount },
    { count: staffCount },
    { count: orders24hCount },
    { count: results24hCount },
    pharmacyVerifResult,
    adverseEventsResult,
    inBasketTasksResult,
    criticalResultsResult,
  ] = await Promise.all([
    supabase.from("encounters").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("slot_start", todayStart.toISOString())
      .lte("slot_start", todayEnd.toISOString()),
    supabase.from("profiles").select("*", { count: "exact", head: true }).neq("role", "patient"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("ordered_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("results")
      .select("*", { count: "exact", head: true })
      .gte("reported_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("type", "med")
      .or("is_controlled_substance.eq.true,high_risk_med.eq.true")
      .in("status", ["pending", "active", "held"])
      .is("pharmacy_verified_at", null),
    supabase
      .from("adverse_events")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed"),
    supabase
      .from("in_basket_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .eq("is_critical", true)
      .or("acknowledgment_status.eq.new,acknowledgment_status.is.null"),
  ]);

  const pharmacyVerifCount = pharmacyVerifResult.count ?? 0;
  const adverseEventsCount = adverseEventsResult.count ?? 0;
  const inBasketCount = inBasketTasksResult.count ?? 0;
  const criticalResultsCount = criticalResultsResult.count ?? 0;

  // Active encounters for force end
  const { data: activeEncountersRaw } = await supabase
    .from("encounters")
    .select("id, patient_id, type, campus, care_setting, admit_date, assigned_to_name")
    .in("status", ["active", "in_progress"])
    .order("admit_date", { ascending: false });
  const patientIds = [...new Set((activeEncountersRaw || []).map((e) => e.patient_id))];
  const { data: encounterPatients } = patientIds.length
    ? await supabase.from("patients").select("id, first_name, last_name, mrn").in("id", patientIds)
    : { data: [] };
  const patientMap = new Map(
    (encounterPatients || []).map((p) => [
      p.id,
      { name: `${p.last_name ?? ""}, ${p.first_name ?? ""}`.replace(/^, |, $/g, "").trim() || "Unknown", mrn: p.mrn },
    ])
  );
  const activeEncounters = (activeEncountersRaw || []).map((e) => {
    const pt = patientMap.get(e.patient_id);
    return { ...e, patient_name: pt?.name ?? null, mrn: pt?.mrn ?? null };
  });

  // Pending LOA requests (managers approve/deny)
  const { data: pendingLoasRaw } = await supabase
    .from("time_off_requests")
    .select("id, user_id, start_date, end_date, type, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const loaUserIds = [...new Set((pendingLoasRaw || []).map((r) => r.user_id))];
  const { data: loaProfiles } = loaUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", loaUserIds)
    : { data: [] };
  const loaNameMap = new Map((loaProfiles || []).map((p) => [p.id, p.full_name]));
  const pendingLoas = (pendingLoasRaw || []).map((r) => ({
    ...r,
    requester_name: loaNameMap.get(r.user_id) ?? null,
  }));

  // Quick links (managers manage)
  const { data: quickLinks } = await supabase
    .from("quick_links")
    .select("id, label, url, category, sort_order, is_active")
    .order("sort_order");

  // Feedback & suggestions (type = feedback)
  const { data: feedbackRaw } = await supabase
    .from("staff_feedback")
    .select("id, user_id, content, created_at")
    .eq("type", "feedback")
    .order("created_at", { ascending: false })
    .limit(50);
  const feedbackUserIds = [...new Set((feedbackRaw || []).map((f) => f.user_id).filter(Boolean))] as string[];
  const { data: feedbackProfiles } = feedbackUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", feedbackUserIds)
    : { data: [] };
  const feedbackNameMap = new Map((feedbackProfiles || []).map((p) => [p.id, p.full_name]));
  const feedback = (feedbackRaw || []).map((f) => ({
    ...f,
    submitter_name: f.user_id ? feedbackNameMap.get(f.user_id) ?? null : "Anonymous",
  }));

  // Weekly hours clocked by person (auto-resets by week boundary)
  const weekStartIso = getWeekStartIso();
  const { data: timeEntries } = await supabase
    .from("staff_time_entries")
    .select("user_id, clock_in_at, clock_out_at")
    .gte("clock_in_at", weekStartIso);
  const hoursByUserId = new Map<string, number>();
  for (const e of timeEntries || []) {
    const start = new Date(e.clock_in_at).getTime();
    const end = e.clock_out_at ? new Date(e.clock_out_at).getTime() : Date.now();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const hours = (end - start) / (1000 * 60 * 60);
    hoursByUserId.set(e.user_id, (hoursByUserId.get(e.user_id) ?? 0) + hours);
  }
  const hoursUserIds = [...hoursByUserId.keys()];
  const { data: hoursProfiles } = hoursUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", hoursUserIds)
    : { data: [] };
  const hoursNameMap = new Map((hoursProfiles || []).map((p) => [p.id, p.full_name]));
  const hoursByPerson = hoursUserIds
    .map((uid) => ({
      user_id: uid,
      full_name: hoursNameMap.get(uid) ?? null,
      total_hours: hoursByUserId.get(uid) ?? 0,
    }))
    .sort((a, b) => b.total_hours - a.total_hours);

  // Recent entries for manager correction (including open clock-ins)
  const { data: recentTimeEntries } = await supabase
    .from("staff_time_entries")
    .select("id, user_id, clock_in_at, clock_out_at, created_at")
    .order("created_at", { ascending: false })
    .limit(75);
  const correctionUserIds = [
    ...new Set((recentTimeEntries || []).map((entry) => entry.user_id).filter(Boolean)),
  ] as string[];
  const { data: correctionProfiles } = correctionUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", correctionUserIds)
    : { data: [] };
  const correctionNameMap = new Map((correctionProfiles || []).map((p) => [p.id, p.full_name]));
  const timeEntriesForCorrection = (recentTimeEntries || []).map((entry) => ({
    ...entry,
    full_name: correctionNameMap.get(entry.user_id) ?? null,
  }));

  // Staff list and upcoming shifts for shift creation
  const { data: staffList } = await supabase
    .from("profiles")
    .select("id, full_name, department")
    .neq("role", "patient")
    .order("full_name");
  const now = new Date().toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: adminUpcomingShifts } = await supabase
    .from("staff_shifts")
    .select("id, user_id, department, shift_type, scheduled_start, scheduled_end, status")
    .gte("scheduled_start", now)
    .lte("scheduled_start", thirtyDays)
    .in("status", ["scheduled"])
    .order("scheduled_start")
    .limit(100);
  const shiftUserIds = [...new Set((adminUpcomingShifts || []).map((s) => s.user_id))];
  const { data: shiftProfiles } = shiftUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", shiftUserIds)
    : { data: [] };
  const shiftNameMap = new Map((shiftProfiles || []).map((p) => [p.id, p.full_name]));
  const shiftsWithNames = (adminUpcomingShifts || []).map((s) => ({
    ...s,
    staff_name: shiftNameMap.get(s.user_id) ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 text-slate-900 dark:text-foreground">
          <Building2 className="h-6 w-6 text-primary shrink-0" />
          Administrator Panel
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Operational overview, staff scheduling, and institution settings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href="/chart">
          <Card className="h-full border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Active Encounters</p>
              <p className="mt-1 text-2xl font-semibold">{activeEncounterCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/schedule">
          <Card className="h-full border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Today&apos;s Appointments</p>
              <p className="mt-1 text-2xl font-semibold">{todayAppointmentCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Staff Members</p>
            <p className="mt-1 text-2xl font-semibold">{staffCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Orders (24h)</p>
            <p className="mt-1 text-2xl font-semibold">{orders24hCount ?? 0}</p>
          </CardContent>
        </Card>
        <Link href="/results">
          <Card className="h-full border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Results (24h)</p>
              <p className="mt-1 text-2xl font-semibold">{results24hCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <CollapsiblePanel
        title="Operations Snapshot"
        description="High-priority queues and encounter controls."
        defaultOpen
        summaryRight={
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {pharmacyVerifCount + adverseEventsCount + inBasketCount + criticalResultsCount} open items
          </span>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/pharmacist">
              <Card className="border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Pharmacy Verifications</p>
                    <p className="mt-1 text-xl font-semibold">{pharmacyVerifCount}</p>
                  </div>
                  <Pill className="h-7 w-7 text-amber-500" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/settings/institution#safety">
              <Card className="border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Adverse Events</p>
                    <p className="mt-1 text-xl font-semibold">{adverseEventsCount}</p>
                  </div>
                  <AlertTriangle className="h-7 w-7 text-red-500" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/inbasket">
              <Card className="border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Open Tasks</p>
                    <p className="mt-1 text-xl font-semibold">{inBasketCount}</p>
                  </div>
                  <Inbox className="h-7 w-7 text-primary" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/results">
              <Card className="border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20">
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Critical Results</p>
                    <p className="mt-1 text-xl font-semibold">{criticalResultsCount}</p>
                  </div>
                  <ShieldAlert className="h-7 w-7 text-red-500" />
                </CardContent>
              </Card>
            </Link>
          </div>
          <AdminForceEndEncountersSection activeEncounters={activeEncounters} />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Workforce Management"
        description="Scheduling, leave approvals, quick links, feedback, and hour totals."
        summaryRight={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            {(staffList || []).length} staff
          </div>
        }
      >
        <div className="space-y-6">
          <AdminShiftsSection staff={staffList || []} upcomingShifts={shiftsWithNames} />
          <div className="grid gap-6 lg:grid-cols-2">
            <AdminLoaSection pendingLoas={pendingLoas} />
            <AdminQuickLinksSection links={quickLinks || []} />
            <AdminFeedbackSection feedback={feedback} />
            <AdminHoursSection
              hoursByPerson={hoursByPerson}
              timeEntriesForCorrection={timeEntriesForCorrection}
              weekStartIso={weekStartIso}
            />
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Institution Controls"
        description="Fast access to full institution configuration."
        summaryRight={<Settings className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/settings/institution"
            className="rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20"
          >
            <p className="font-medium text-sm">Open Institution Settings</p>
            <p className="mt-1 text-xs text-muted-foreground">Roles, departments, audit, ICD-10, and chat controls.</p>
          </Link>
          <Link
            href="/settings/institution#safety"
            className="rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20"
          >
            <p className="font-medium text-sm">Safety Queue</p>
            <p className="mt-1 text-xs text-muted-foreground">Review adverse events and close investigations.</p>
          </Link>
          <Link
            href="/schedule"
            className="rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50/50 dark:border-border dark:hover:bg-muted/20"
          >
            <p className="font-medium text-sm">Master Schedule</p>
            <p className="mt-1 text-xs text-muted-foreground">Jump to global scheduling view.</p>
          </Link>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            Updated in real time from operational tables.
          </span>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
