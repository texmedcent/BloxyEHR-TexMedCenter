import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Activity, ClipboardList, FlaskConical, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveClock } from "@/components/chart/LiveClock";
import { StartEncounterButton } from "@/components/chart/StartEncounterButton";
import { StartChartCard } from "@/components/chart/StartChartCard";

export default async function ChartPage() {
  const supabase = await createClient();
  const { data: recentPatients } = await supabase
    .from("patients")
    .select("id, mrn, first_name, last_name")
    .neq("mrn", "MRN001")
    .neq("mrn", "MRN002")
    .neq("mrn", "MRN003")
    .neq("mrn", "MRN004")
    .neq("mrn", "MRN005")
    .order("created_at", { ascending: false })
    .limit(6);

  const { count: activeEncounterCount } = await supabase
    .from("encounters")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, patient_id, type, status, ordered_at")
    .order("ordered_at", { ascending: false })
    .limit(8);

  const { data: recentResults } = await supabase
    .from("results")
    .select("id, patient_id, type, status, reported_at")
    .order("reported_at", { ascending: false })
    .limit(8);

  const { data: triageQueue } = await supabase
    .from("patient_checkins")
    .select("id, patient_id, campus, status, checked_in_at")
    .eq("status", "triage")
    .order("checked_in_at", { ascending: true })
    .limit(10);

  const patientIds = [
    ...new Set(
      [...(recentOrders || []), ...(recentResults || []), ...(triageQueue || [])]
        .map((r) => r.patient_id)
        .filter(Boolean)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Chart Dashboard</h1>
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
            <div className="text-2xl font-semibold text-slate-900">
              {activeEncounterCount ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Status = active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#1a4d8c]" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {recentOrders?.length ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Last 8 entries</p>
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
            <div className="text-2xl font-semibold text-slate-900">
              {recentResults?.length ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Last 8 entries</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders?.length ? (
              <div className="space-y-2">
                {recentOrders.map((order) => {
                  const patient = patientMap.get(order.patient_id);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {order.type}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {patient
                            ? `${patient.last_name}, ${patient.first_name} (MRN: ${patient.mrn})`
                            : "Unknown patient"}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {order.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No recent orders</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {recentResults?.length ? (
              <div className="space-y-2">
                {recentResults.map((result) => {
                  const patient = patientMap.get(result.patient_id);
                  return (
                    <div
                      key={result.id}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize">
                          {result.type}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {patient
                            ? `${patient.last_name}, ${patient.first_name} (MRN: ${patient.mrn})`
                            : "Unknown patient"}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {result.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No recent results</p>
            )}
          </CardContent>
        </Card>
      </div>

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
                    className="flex items-center justify-between gap-2 p-3 rounded-md border border-amber-300 bg-amber-50"
                  >
                    <Link
                      href={`/chart/${p.id}`}
                      className="min-w-0 flex items-center gap-2"
                    >
                      <User className="h-4 w-4 text-amber-700" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate text-slate-900">
                          {p.last_name}, {p.first_name}
                        </p>
                        <p className="text-xs text-slate-600">
                          MRN: {p.mrn} · {q.campus}
                        </p>
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

            {recentPatients?.length ? (
              recentPatients.map((p) => (
                <Link
                  key={p.id}
                  href={`/chart/${p.id}`}
                  className="flex items-center gap-3 p-3 rounded-md border bg-white hover:bg-[#1a4d8c]/5 transition-colors text-left"
                >
                  <User className="h-4 w-4 text-[#1a4d8c]" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {p.last_name}, {p.first_name}
                    </p>
                    <p className="text-xs text-slate-500">MRN: {p.mrn}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No patients yet. Run the seed script or add patients.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
