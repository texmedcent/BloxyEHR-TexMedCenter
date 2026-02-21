import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Activity, ClipboardList, FlaskConical, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveClock } from "@/components/chart/LiveClock";
import { StartEncounterButton } from "@/components/chart/StartEncounterButton";
import { StartChartCard } from "@/components/chart/StartChartCard";
import { DashboardRecentPanels } from "@/components/chart/DashboardRecentPanels";

export default async function ChartPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  const { data: currentProfile } = userId
    ? await supabase
        .from("profiles")
        .select("dashboard_orders_cleared_at, dashboard_results_cleared_at")
        .eq("id", userId)
        .maybeSingle()
    : { data: null };
  const ordersClearedAt = currentProfile?.dashboard_orders_cleared_at ?? null;
  const resultsClearedAt = currentProfile?.dashboard_results_cleared_at ?? null;

  const { count: activeEncounterCount } = await supabase
    .from("encounters")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  let ordersQuery = supabase
    .from("orders")
    .select("id, patient_id, type, status, ordered_at")
    .order("ordered_at", { ascending: false })
    .limit(8);
  if (ordersClearedAt) {
    ordersQuery = ordersQuery.gte("ordered_at", ordersClearedAt);
  }
  const { data: recentOrders } = await ordersQuery;

  let resultsQuery = supabase
    .from("results")
    .select("id, patient_id, type, status, reported_at")
    .order("reported_at", { ascending: false })
    .limit(8);
  if (resultsClearedAt) {
    resultsQuery = resultsQuery.gte("reported_at", resultsClearedAt);
  }
  const { data: recentResults } = await resultsQuery;

  const { data: triageQueue } = await supabase
    .from("patient_checkins")
    .select("id, patient_id, campus, status, checked_in_at, chief_complaint, acuity_level, pain_score, arrival_mode")
    .eq("status", "triage")
    .order("checked_in_at", { ascending: true })
    .limit(10);

  const { data: activeEncounterRows } = await supabase
    .from("encounters")
    .select("patient_id, admit_date")
    .eq("status", "active")
    .order("admit_date", { ascending: false })
    .limit(30);

  const activeEncounterPatientIds = [
    ...new Set((activeEncounterRows || []).map((row) => row.patient_id).filter(Boolean)),
  ] as string[];
  const triagePatientIds = new Set((triageQueue || []).map((row) => row.patient_id).filter(Boolean));

  const patientIds = [
    ...new Set(
      [...(recentOrders || []), ...(recentResults || []), ...(triageQueue || [])]
        .map((r) => r.patient_id)
        .filter(Boolean)
        .concat(activeEncounterPatientIds)
    ),
  ];
  const { data: mappedPatients } =
    patientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, first_name, last_name, mrn")
          .in("id", patientIds)
      : { data: [] };

  const patientMap = new Map((mappedPatients || []).map((p) => [p.id, p]));
  const quickAccessPatients = activeEncounterPatientIds
    .filter((id) => !triagePatientIds.has(id))
    .map((id) => patientMap.get(id))
    .filter((p): p is { id: string; first_name: string; last_name: string; mrn: string } =>
      Boolean(p)
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-foreground">Chart Dashboard</h1>
        <LiveClock />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Ongoing Encounters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
              {activeEncounterCount ?? 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Status = active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
              {recentOrders?.length ?? 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Last 8 entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-indigo-600" />
              Recent Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
              {recentResults?.length ?? 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Last 8 entries</p>
          </CardContent>
        </Card>
      </div>

      <DashboardRecentPanels
        recentOrders={recentOrders || []}
        recentResults={recentResults || []}
        patients={mappedPatients || []}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Quick Access: Patients</CardTitle>
          <StartChartCard />
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {triageQueue?.length ? (
              triageQueue.map((q) => {
                const p = patientMap.get(q.patient_id);
                if (!p) return null;
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50"
                  >
                    <Link
                      href={`/chart/${p.id}`}
                      className="min-w-0 flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-amber-700" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate text-slate-900 dark:text-foreground">
                          {p.last_name}, {p.first_name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-muted-foreground">
                          MRN: {p.mrn} · {q.campus}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-muted-foreground">
                          {(q.acuity_level || "acuity not set").replaceAll("_", " ").toUpperCase()}
                          {typeof q.pain_score === "number" ? ` · Pain ${q.pain_score}/10` : ""}
                          {q.arrival_mode ? ` · ${q.arrival_mode.replaceAll("_", " ")}` : ""}
                        </p>
                        {q.chief_complaint && (
                          <p className="text-xs text-slate-600 dark:text-muted-foreground truncate">
                            CC: {q.chief_complaint}
                          </p>
                        )}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-orange-500 text-white border-0">TRIAGE</Badge>
                      <StartEncounterButton
                        checkinId={q.id}
                        patientId={p.id}
                        campus={q.campus}
                      />
                    </div>
                  </div>
                );
              })
            ) : null}

            {quickAccessPatients.length ? (
              quickAccessPatients.map((p) => (
                <Link
                  key={p.id}
                  href={`/chart/${p.id}`}
                  className="flex items-center gap-3 p-3 rounded-md border border-border bg-white dark:bg-card hover:bg-[#1a4d8c]/5 dark:hover:bg-primary/10 transition-colors text-left"
                >
                  <User className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {p.last_name}, {p.first_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground">MRN: {p.mrn}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-muted-foreground">
                No active encounters right now.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
