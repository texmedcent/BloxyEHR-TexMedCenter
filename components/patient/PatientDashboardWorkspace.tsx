"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Pill,
  Send,
  Stethoscope,
  TestTube2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatOrderDetails, getMedicationName } from "@/lib/orders";

type EncounterRow = {
  id: string;
  type: string;
  status: string;
  admit_date: string | null;
  discharge_date: string | null;
  final_diagnosis_description?: string | null;
  disposition_type?: string | null;
  discharge_instructions?: string | null;
  return_precautions?: string | null;
};

type ResultRow = {
  id: string;
  order_id: string | null;
  encounter_id: string | null;
  type: string;
  status: string;
  reported_at: string;
  value: unknown;
  is_critical?: boolean | null;
};

type AppointmentRow = {
  id: string;
  slot_start: string;
  slot_end: string;
  type: string | null;
  status: string | null;
  provider_name: string | null;
};

type MedOrderRow = {
  id: string;
  encounter_id: string | null;
  status: string;
  ordered_at: string;
  details: unknown;
  is_controlled_substance?: boolean | null;
  med_reconciled_at?: string | null;
  med_reconciled_by_name?: string | null;
  administration_frequency?: string | null;
  next_due_at?: string | null;
};

type MedAdminLogRow = {
  order_id: string;
  event_type: string;
  event_at: string;
  scheduled_for: string | null;
  was_overdue: boolean;
};

type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  created_at: string;
};

type DashboardNote = {
  id: string;
  encounter_id: string;
  type: string;
  content: string;
  signed_at: string | null;
  created_at: string;
};

type ProcedureRow = {
  id: string;
  encounter_id: string | null;
  status: string;
  ordered_at: string;
  details: unknown;
};

function parseResultSeverity(value: unknown): "critical" | "abnormal" | "normal" | "unknown" {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const record = value as Record<string, unknown>;
  const flags = record.flags;
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return "unknown";
  const labels = Object.values(flags).map((f) => String(f));
  if (labels.some((f) => f.includes("critical"))) return "critical";
  if (labels.some((f) => f.includes("abnormal"))) return "abnormal";
  if (labels.some((f) => f === "normal")) return "normal";
  return "unknown";
}

function formatResultPreview(value: unknown): string {
  if (value === null || value === undefined) return "No value";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value !== "object" || Array.isArray(value)) return String(value);
  const record = value as Record<string, unknown>;
  const values = record.values;
  if (values && typeof values === "object" && !Array.isArray(values)) {
    return Object.entries(values as Record<string, unknown>)
      .slice(0, 2)
      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${String(v)}`)
      .join(" | ");
  }
  return JSON.stringify(value);
}

export function PatientDashboardWorkspace({
  userId,
  patientId,
  encounters,
  results,
  medOrders,
  medAdminLogs,
  appointments,
  tasks,
  procedures,
  notes,
}: {
  userId: string;
  patientId: string | null;
  encounters: EncounterRow[];
  results: ResultRow[];
  medOrders: MedOrderRow[];
  medAdminLogs: MedAdminLogRow[];
  appointments: AppointmentRow[];
  tasks: TaskRow[];
  procedures: ProcedureRow[];
  notes: DashboardNote[];
}) {
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<{ title: string; body: string } | null>(null);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const activeMeds = useMemo(
    () =>
      medOrders.filter((m) => {
        const normalized = (m.status || "").toLowerCase();
        return normalized !== "discontinued" && normalized !== "cancelled";
      }),
    [medOrders]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.slot_start).getTime() >= Date.now())
        .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()),
    [appointments]
  );

  const messageThreads = useMemo(
    () => tasks.filter((t) => t.title.toLowerCase().startsWith("message:")),
    [tasks]
  );

  const actionItems = useMemo(() => {
    const dueSoonAppointments = upcomingAppointments
      .filter((a) => new Date(a.slot_start).getTime() - Date.now() <= 1000 * 60 * 60 * 48)
      .map((a) => ({
        key: `appt-${a.id}`,
        title: "Upcoming appointment reminder",
        details: `${a.type || "Visit"} on ${format(new Date(a.slot_start), "MM/dd/yyyy HH:mm")}`,
      }));

    const criticalResults = results
      .filter((r) => r.is_critical || parseResultSeverity(r.value) === "critical")
      .slice(0, 3)
      .map((r) => ({
        key: `result-${r.id}`,
        title: "Critical result available",
        details: `${r.type} reported ${formatDistanceToNow(new Date(r.reported_at), { addSuffix: true })}`,
      }));

    return [...dueSoonAppointments, ...criticalResults];
  }, [results, upcomingAppointments]);

  const medLogByOrder = useMemo(() => {
    const grouped = new Map<string, MedAdminLogRow[]>();
    for (const log of medAdminLogs) {
      const list = grouped.get(log.order_id) || [];
      list.push(log);
      grouped.set(log.order_id, list);
    }
    for (const [, list] of grouped) {
      list.sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());
    }
    return grouped;
  }, [medAdminLogs]);

  const openTaskCount = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;

  const sendPatientRequest = async (title: string, details: string) => {
    setRequestBusy(title);
    setRequestMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("in_basket_tasks").insert({
      owner_id: userId,
      owner_name: "Patient",
      patient_id: patientId,
      title,
      details,
      priority: "normal",
      status: "open",
      created_by: userId,
      created_by_name: "Patient Portal",
    });
    if (error) {
      setRequestMessage(error.message || "Unable to submit request.");
      setRequestBusy(null);
      return;
    }
    setRequestMessage("Request sent successfully.");
    setRequestBusy(null);
  };

  const submitMessage = async () => {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    await sendPatientRequest(`Message: ${messageSubject.trim()}`, messageBody.trim());
    setMessageSubject("");
    setMessageBody("");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-200 dark:border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TestTube2 className="h-4 w-4 text-indigo-600" />
              Released Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{results.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Pill className="h-4 w-4 text-[#1a4d8c]" />
              Active Medications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{activeMeds.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BellRing className="h-4 w-4 text-amber-600" />
              Open Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{openTaskCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TestTube2 className="h-4 w-4 text-indigo-600" />
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.slice(0, 12).map((result) => {
              const severity = parseResultSeverity(result.value);
              const chipClass =
                severity === "critical"
                  ? "bg-red-50 text-red-700"
                  : severity === "abnormal"
                  ? "bg-amber-50 text-amber-700"
                  : severity === "normal"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600";
              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => setSelectedResult(result)}
                  className="w-full rounded-lg border border-slate-200 dark:border-border px-3 py-2 text-left hover:border-[#1a4d8c]/40 dark:hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize">{result.type}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[11px] ${chipClass}`}>
                        {severity === "unknown" ? "Unrated" : severity}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] uppercase text-slate-600">
                        {result.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {format(new Date(result.reported_at), "MM/dd/yyyy HH:mm")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{formatResultPreview(result.value)}</p>
                </button>
              );
            })}
            {results.length === 0 && <p className="text-sm text-slate-500">No released results yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Pill className="h-4 w-4 text-[#1a4d8c]" />
              Medications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeMeds.slice(0, 12).map((med) => {
              const label = getMedicationName(med.details) || formatOrderDetails("med", med.details);
              const logs = medLogByOrder.get(med.id) || [];
              const latestLog = logs[0];
              const administeredCount = logs.filter((l) => l.event_type === "administered").length;
              return (
                <div key={med.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {label}
                      {med.is_controlled_substance && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                          Controlled
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-slate-500 capitalize">{med.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {med.administration_frequency ? `Schedule: ${med.administration_frequency}` : "Schedule: As ordered"}
                    {med.next_due_at ? ` · Next due ${format(new Date(med.next_due_at), "MM/dd HH:mm")}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Admin history: {administeredCount} documented doses
                    {latestLog ? ` · Last event ${format(new Date(latestLog.event_at), "MM/dd HH:mm")}` : ""}
                  </p>
                  {med.med_reconciled_at && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Medication list reviewed by {med.med_reconciled_by_name || "Clinician"} on{" "}
                      {format(new Date(med.med_reconciled_at), "MM/dd/yyyy HH:mm")}
                    </p>
                  )}
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={requestBusy !== null}
                      onClick={() =>
                        sendPatientRequest(
                          "Refill Request",
                          `Please review refill request for medication: ${label}.`
                        )
                      }
                    >
                      {requestBusy ? "Submitting..." : "Request Refill"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {activeMeds.length === 0 && <p className="text-sm text-slate-500">No active medications listed.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Stethoscope className="h-4 w-4 text-slate-700" />
              Visits & Encounter Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {encounters.slice(0, 12).map((enc) => (
              <div key={enc.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize">{enc.type.replaceAll("_", " ")}</p>
                  <span className="text-xs uppercase text-slate-500">{enc.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {enc.admit_date ? format(new Date(enc.admit_date), "MM/dd/yyyy HH:mm") : "Unknown admit"}{" "}
                  {enc.discharge_date ? `to ${format(new Date(enc.discharge_date), "MM/dd/yyyy HH:mm")}` : ""}
                </p>
                {(enc.final_diagnosis_description || enc.disposition_type) && (
                  <p className="mt-1 text-xs text-slate-600">
                    {enc.final_diagnosis_description || "Diagnosis pending"} ·{" "}
                    {(enc.disposition_type || "pending").replaceAll("_", " ")}
                  </p>
                )}
              </div>
            ))}
            {encounters.length === 0 && <p className="text-sm text-slate-500">No encounters found.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-[#1a4d8c]" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingAppointments.slice(0, 10).map((appt) => (
              <div key={appt.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
                <p className="text-sm font-medium">{appt.type || "Visit"}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {format(new Date(appt.slot_start), "MM/dd/yyyy HH:mm")} -{" "}
                  {format(new Date(appt.slot_end), "HH:mm")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Provider: {appt.provider_name || "Assigned Clinician"} · Status: {appt.status || "scheduled"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={requestBusy !== null}
                    onClick={() =>
                      sendPatientRequest(
                        "Appointment Change Request",
                        `Please help reschedule appointment on ${format(new Date(appt.slot_start), "MM/dd/yyyy HH:mm")}.`
                      )
                    }
                  >
                    Request Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={requestBusy !== null}
                    onClick={() =>
                      sendPatientRequest(
                        "Appointment Cancellation Request",
                        `Please cancel appointment on ${format(new Date(appt.slot_start), "MM/dd/yyyy HH:mm")}.`
                      )
                    }
                  >
                    Request Cancel
                  </Button>
                </div>
              </div>
            ))}
            {upcomingAppointments.length === 0 && (
              <p className="text-sm text-slate-500">No upcoming appointments scheduled.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="h-4 w-4 text-emerald-700" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notes.slice(0, 8).map((note) => (
              <button
                key={note.id}
                type="button"
                className="w-full rounded-lg border border-slate-200 dark:border-border px-3 py-2 text-left hover:border-[#1a4d8c]/40 dark:hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
                onClick={() =>
                  setSelectedDoc({
                    title: note.type.replaceAll("_", " "),
                    body: note.content,
                  })
                }
              >
                <p className="text-sm font-medium capitalize">{note.type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-slate-500">{format(new Date(note.created_at), "MM/dd/yyyy HH:mm")}</p>
              </button>
            ))}
            {procedures.slice(0, 4).map((proc) => (
              <button
                key={proc.id}
                type="button"
                className="w-full rounded-lg border border-slate-200 dark:border-border px-3 py-2 text-left hover:border-[#1a4d8c]/40 dark:hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
                onClick={() =>
                  setSelectedDoc({
                    title: `Procedure (${proc.status})`,
                    body: formatOrderDetails("procedure", proc.details),
                  })
                }
              >
                <p className="text-sm font-medium">Procedure Summary</p>
                <p className="mt-1 text-xs text-slate-500">{format(new Date(proc.ordered_at), "MM/dd/yyyy HH:mm")}</p>
              </button>
            ))}
            {notes.length === 0 && procedures.length === 0 && (
              <p className="text-sm text-slate-500">No released documents available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BellRing className="h-4 w-4 text-amber-600" />
              Action Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actionItems.map((item) => (
              <div key={item.key} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2">
                <p className="text-sm font-medium text-amber-900">{item.title}</p>
                <p className="mt-1 text-xs text-amber-800">{item.details}</p>
              </div>
            ))}
            {tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{task.title}</p>
                  <span className="text-[11px] uppercase text-slate-500">{task.status}</span>
                </div>
                {task.details && <p className="mt-1 text-xs text-slate-600">{task.details}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {task.due_at ? `Due ${format(new Date(task.due_at), "MM/dd/yyyy HH:mm")}` : "No due time"}
                </p>
              </div>
            ))}
            {actionItems.length === 0 && tasks.length === 0 && (
              <p className="text-sm text-slate-500">No pending tasks. You are all caught up.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-[#1a4d8c]" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {messageThreads.slice(0, 8).map((thread) => (
              <div key={thread.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
                <p className="text-sm font-medium">{thread.title.replace(/^Message:\s*/i, "") || "Portal message"}</p>
                {thread.details && <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{thread.details}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {format(new Date(thread.created_at), "MM/dd/yyyy HH:mm")} · {thread.status}
                </p>
              </div>
            ))}
            {messageThreads.length === 0 && (
              <p className="text-sm text-slate-500">No messages yet. Send one below to contact your care team.</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Send a new message</p>
            <div className="space-y-2">
              <Input
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Subject"
              />
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write your question for your care team..."
                className="min-h-[90px]"
              />
              <Button onClick={submitMessage} disabled={requestBusy !== null || !messageSubject.trim() || !messageBody.trim()}>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </div>
          </div>
          {requestMessage && <p className="text-xs text-slate-600">{requestMessage}</p>}
        </CardContent>
      </Card>

      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">Result Detail · {selectedResult.type}</CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setSelectedResult(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto space-y-3">
              <p className="text-xs text-slate-500">
                Reported {format(new Date(selectedResult.reported_at), "MM/dd/yyyy HH:mm")} · Status{" "}
                {selectedResult.status.toUpperCase()}
              </p>
              {selectedResult.is_critical && (
                <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  <TriangleAlert className="h-4 w-4" />
                  Critical result
                </div>
              )}
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted p-3 text-sm text-slate-700 dark:text-foreground">
                {typeof selectedResult.value === "string"
                  ? selectedResult.value
                  : JSON.stringify(selectedResult.value, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">{selectedDoc.title}</CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setSelectedDoc(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto space-y-3">
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted p-3 text-sm text-slate-700 dark:text-foreground">
                {selectedDoc.body}
              </pre>
              <div className="inline-flex items-center gap-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Released to patient portal
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
