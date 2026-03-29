"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Pill,
  Send,
  Stethoscope,
  TestTube2,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatOrderDetails, getMedicationName } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { PatientActionCenter, type ActionItem, type TaskRow as ActionTaskRow } from "@/components/patient/PatientActionCenter";
import { PatientMiniCalendar } from "@/components/patient/PatientMiniCalendar";
import { PatientCareTeamMini, type CareMember } from "@/components/patient/PatientCareTeamMini";
import { PatientListEmptyState } from "@/components/patient/PatientListEmptyState";
import { usePatientSchedule } from "@/components/patient/PatientScheduleProvider";

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
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  supervising_attending?: string | null;
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

type ProviderMessageOption = {
  id: string;
  full_name: string | null;
  role: string | null;
  department: string | null;
};

type SentMessageRow = {
  id: string;
  owner_id: string;
  owner_name: string | null;
  title: string;
  details: string | null;
  created_at: string;
  status: string;
  created_by: string | null;
  created_by_name: string | null;
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

type VisitTab = "upcoming" | "past";

const VISIT_TABS: { id: VisitTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

export function PatientDashboardWorkspace({
  userId,
  patientId,
  currentPatientName,
  providers,
  encounters,
  results,
  medOrders,
  medAdminLogs,
  appointments,
  tasks,
  procedures,
  notes,
  careTeamMembers,
  portalMessages,
}: {
  userId: string;
  patientId: string | null;
  currentPatientName: string;
  providers: ProviderMessageOption[];
  encounters: EncounterRow[];
  results: ResultRow[];
  medOrders: MedOrderRow[];
  medAdminLogs: MedAdminLogRow[];
  appointments: AppointmentRow[];
  tasks: TaskRow[];
  procedures: ProcedureRow[];
  notes: DashboardNote[];
  careTeamMembers: CareMember[];
  portalMessages: SentMessageRow[];
}) {
  const { openSchedule } = usePatientSchedule();
  const [visitTab, setVisitTab] = useState<VisitTab>("upcoming");
  const [selectedResult, setSelectedResult] = useState<ResultRow | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<{ title: string; body: string } | null>(null);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [selectedMessageProviderId, setSelectedMessageProviderId] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);
  const [hideMessageBusyId, setHideMessageBusyId] = useState<string | null>(null);
  const [openThreadKey, setOpenThreadKey] = useState<string | null>(null);

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
        .filter((a) => {
          const normalizedStatus = (a.status || "scheduled").toLowerCase();
          return !["cancelled", "completed", "no_show"].includes(normalizedStatus);
        })
        .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()),
    [appointments]
  );

  const pastAppointments = useMemo(
    () =>
      appointments
        .filter((a) => {
          const normalizedStatus = (a.status || "").toLowerCase();
          if (["cancelled", "completed", "no_show"].includes(normalizedStatus)) return true;
          return new Date(a.slot_end).getTime() < Date.now();
        })
        .sort((a, b) => new Date(b.slot_start).getTime() - new Date(a.slot_start).getTime()),
    [appointments]
  );

  const providerOptions = useMemo(() => {
    const byId = new Map<string, ProviderMessageOption>();
    for (const provider of providers) {
      if (!provider?.id) continue;
      byId.set(provider.id, provider);
    }
    for (const member of careTeamMembers) {
      if (!member?.id || byId.has(member.id)) continue;
      byId.set(member.id, {
        id: member.id,
        full_name: member.full_name,
        role: member.role,
        department: null,
      });
    }
    return [...byId.values()].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [providers, careTeamMembers]);

  const visiblePortalMessages = useMemo(
    () => portalMessages.filter((thread) => !hiddenMessageIds.includes(thread.id)),
    [portalMessages, hiddenMessageIds]
  );

  const messageThreads = useMemo(() => {
    const bySubject = new Map<
      string,
      {
        key: string;
        subject: string;
        latestAt: string;
        hasRecentProviderReply: boolean;
        messages: SentMessageRow[];
      }
    >();
    for (const msg of visiblePortalMessages) {
      const subject =
        msg.title.replace(/^Patient Message:\s*/i, "").replace(/^Provider Reply:\s*/i, "").trim() ||
        "Portal message";
      const key = subject.toLowerCase();
      const existing = bySubject.get(key);
      if (!existing) {
        bySubject.set(key, {
          key,
          subject,
          latestAt: msg.created_at,
          hasRecentProviderReply: /^Provider Reply:/i.test(msg.title || ""),
          messages: [msg],
        });
      } else {
        existing.messages.push(msg);
        if (new Date(msg.created_at).getTime() > new Date(existing.latestAt).getTime()) {
          existing.latestAt = msg.created_at;
        }
        if (/^Provider Reply:/i.test(msg.title || "")) {
          existing.hasRecentProviderReply = true;
        }
      }
    }
    const threads = [...bySubject.values()].map((thread) => ({
      ...thread,
      messages: [...thread.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }));
    threads.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
    return threads;
  }, [visiblePortalMessages]);

  const openThread = useMemo(
    () => messageThreads.find((thread) => thread.key === openThreadKey) ?? null,
    [messageThreads, openThreadKey]
  );

  const actionItems: ActionItem[] = useMemo(() => {
    const now = Date.now();
    const ttlMs = 72 * 60 * 60 * 1000;
    return messageThreads
      .filter((thread) => thread.hasRecentProviderReply)
      .filter((thread) => now - new Date(thread.latestAt).getTime() <= ttlMs)
      .map((thread) => ({
        key: `provider-msg-${thread.key}`,
        title: "Check message from Provider!",
        details: "",
      }));
  }, [messageThreads]);

  const actionCenterTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const title = (task.title || "").toLowerCase();
        return !title.startsWith("provider reply:") && !title.startsWith("patient message:");
      }),
    [tasks]
  );

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

  const activeEncounterList = useMemo(
    () => encounters.filter((e) => (e.status || "").toLowerCase() === "active"),
    [encounters]
  );

  const pastEncounters = useMemo(() => {
    const list = encounters.filter((e) => (e.status || "").toLowerCase() !== "active");
    return [...list].sort((a, b) => {
      const ta = a.admit_date ? new Date(a.admit_date).getTime() : 0;
      const tb = b.admit_date ? new Date(b.admit_date).getTime() : 0;
      return tb - ta;
    });
  }, [encounters]);

  const formatDue = (due: string | null) =>
    due ? `Due ${format(new Date(due), "MM/dd/yyyy HH:mm")}` : "No due time";

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

  const sendMessageToProvider = async () => {
    if (!selectedMessageProviderId || !messageSubject.trim() || !messageBody.trim()) return;
    const provider = providerOptions.find((p) => p.id === selectedMessageProviderId);
    if (!provider) return;

    setRequestBusy(`Patient Message: ${messageSubject.trim()}`);
    setRequestMessage(null);
    const supabase = createClient();

    const { error } = await supabase.from("in_basket_tasks").insert({
      owner_id: provider.id,
      owner_name: provider.full_name ?? "Provider",
      patient_id: patientId,
      title: `Patient Message: ${messageSubject.trim()}`,
      details: `From: ${currentPatientName}\nTo: ${provider.full_name ?? "Provider"}\n\n${messageBody.trim()}`,
      priority: "normal",
      status: "open",
      created_by: userId,
      created_by_name: currentPatientName,
    });

    if (error) {
      setRequestMessage(error.message || "Unable to send message.");
      setRequestBusy(null);
      return;
    }

    setRequestMessage("Message sent to provider.");
    setMessageSubject("");
    setMessageBody("");
    setRequestBusy(null);
  };

  const submitMessage = async () => {
    await sendMessageToProvider();
  };

  const hidePortalMessage = async (threadId: string) => {
    setHideMessageBusyId(threadId);
    setRequestMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("in_basket_tasks")
      .update({ patient_hidden_at: new Date().toISOString() })
      .eq("id", threadId);
    setHideMessageBusyId(null);
    if (error) {
      setRequestMessage(error.message || "Unable to hide message.");
      return;
    }
    setHiddenMessageIds((prev) => (prev.includes(threadId) ? prev : [...prev, threadId]));
    setRequestMessage("Message hidden.");
  };

  const renderEncounterRow = (enc: EncounterRow) => (
    <div key={enc.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium capitalize">{enc.type.replaceAll("_", " ")}</p>
        <span className="text-xs uppercase text-slate-500">{enc.status}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {enc.admit_date ? format(new Date(enc.admit_date), "MM/dd/yyyy HH:mm") : "Unknown admit"}{" "}
        {enc.discharge_date ? `to ${format(new Date(enc.discharge_date), "MM/dd/yyyy HH:mm")}` : ""}
      </p>
      {(enc.assigned_to_name || enc.supervising_attending) && (
        <p className="mt-1 text-xs text-slate-600">
          Provider: {enc.assigned_to_name || enc.supervising_attending}
        </p>
      )}
      {(enc.final_diagnosis_description || enc.disposition_type) && (
        <p className="mt-1 text-xs text-slate-600">
          {enc.final_diagnosis_description || "Diagnosis pending"} · {(enc.disposition_type || "pending").replaceAll("_", " ")}
        </p>
      )}
    </div>
  );

  const renderAppointmentRow = (appt: AppointmentRow) => (
    <div key={appt.id} className="rounded-lg border border-primary/25 bg-primary/5 dark:bg-primary/10 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Scheduled visit</p>
      <p className="text-sm font-medium">{appt.type || "Visit"}</p>
      <p className="mt-1 text-xs text-slate-600">
        {format(new Date(appt.slot_start), "MM/dd/yyyy HH:mm")} – {format(new Date(appt.slot_end), "HH:mm")}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Provider: {appt.provider_name || "Assigned clinician"} · {appt.status || "scheduled"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
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
          Request reschedule
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
          Request cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
      <div className="space-y-4 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TestTube2 className="h-4 w-4 text-indigo-600" />
              Test results
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
                  className="w-full rounded-lg border border-slate-200 dark:border-border px-3 py-2 text-left hover:border-primary/40 dark:hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
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
                  <p className="mt-1 text-xs text-slate-500">{format(new Date(result.reported_at), "MM/dd/yyyy HH:mm")}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{formatResultPreview(result.value)}</p>
                </button>
              );
            })}
            {results.length === 0 && (
              <PatientListEmptyState
                title="No released results yet"
                description="When your care team releases labs or imaging, they will appear here."
                onBook={undefined}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Pill className="h-4 w-4 text-primary" />
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
                        sendPatientRequest("Refill Request", `Please review refill request for medication: ${label}.`)
                      }
                    >
                      {requestBusy ? "Submitting..." : "Request refill"}
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
              Visits & encounter timeline
            </CardTitle>
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-1 mt-2">
              {VISIT_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVisitTab(id)}
                  className={cn(
                    "flex-1 min-w-[100px] rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    visitTab === id
                      ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-sm"
                      : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {visitTab === "upcoming" && (
              <>
                {upcomingAppointments.map(renderAppointmentRow)}
                {activeEncounterList.map(renderEncounterRow)}
                {upcomingAppointments.length === 0 && activeEncounterList.length === 0 && (
                  <PatientListEmptyState
                    title="Nothing upcoming"
                    description="You have no scheduled visits or active encounters. Plan your next visit below."
                    onBook={() => openSchedule()}
                  />
                )}
              </>
            )}
            {visitTab === "past" && (
              <>
                {pastAppointments.map(renderAppointmentRow)}
                {pastEncounters.slice(0, 20).map(renderEncounterRow)}
                {pastAppointments.length === 0 && pastEncounters.length === 0 && (
                  <PatientListEmptyState
                    title="No past visits on file"
                    description="Your completed visits will appear here after discharge."
                    onBook={() => openSchedule()}
                  />
                )}
              </>
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
                className="w-full rounded-lg border border-slate-200 dark:border-border px-3 py-2 text-left hover:border-primary/40 dark:hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
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
                className="w-full rounded-lg border border-slate-200 dark:border-border px-3 py-2 text-left hover:border-primary/40 dark:hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
                onClick={() =>
                  setSelectedDoc({
                    title: `Procedure (${proc.status})`,
                    body: formatOrderDetails("procedure", proc.details),
                  })
                }
              >
                <p className="text-sm font-medium">Procedure summary</p>
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
              <MessageSquare className="h-4 w-4 text-primary" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {visiblePortalMessages.slice(0, 8).map((thread) => {
                const isReplyToPatient = thread.owner_id === userId;
                const directionLabel = isReplyToPatient
                  ? `From ${thread.created_by_name || thread.owner_name || "Provider"}`
                  : `To ${thread.owner_name || "Provider"}`;
                return (
                <div key={thread.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {thread.title.replace(/^Patient Message:\s*/i, "").replace(/^Provider Reply:\s*/i, "") || "Portal message"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => hidePortalMessage(thread.id)}
                      disabled={hideMessageBusyId === thread.id}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      {hideMessageBusyId === thread.id ? "Hiding..." : "Hide"}
                    </Button>
                  </div>
                  {thread.details && <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{thread.details}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    {format(new Date(thread.created_at), "MM/dd/yyyy HH:mm")} · {directionLabel} · {thread.status}
                  </p>
                </div>
              )})}
              {visiblePortalMessages.length === 0 && (
                <p className="text-sm text-slate-500">No messages yet. Send one below to contact your care team.</p>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-border p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Send a new message</p>
              <div className="space-y-2">
                <select
                  value={selectedMessageProviderId}
                  onChange={(e) => setSelectedMessageProviderId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select provider</option>
                  {providerOptions.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.full_name || "Provider"}
                      {provider.role ? ` (${provider.role.replaceAll("_", " ")})` : ""}
                      {provider.department ? ` - ${provider.department}` : ""}
                    </option>
                  ))}
                </select>
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
                <Button
                  onClick={submitMessage}
                  disabled={
                    requestBusy !== null ||
                    !selectedMessageProviderId ||
                    !messageSubject.trim() ||
                    !messageBody.trim()
                  }
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send message
                </Button>
              </div>
            </div>
            {requestMessage && <p className="text-xs text-slate-600">{requestMessage}</p>}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <PatientActionCenter
          actionItems={actionItems}
          tasks={actionCenterTasks as ActionTaskRow[]}
          formatDue={formatDue}
          onActionItemClick={(item) => {
            const key = item.key.replace(/^provider-msg-/, "");
            setOpenThreadKey(key);
          }}
          headerActions={
            <>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={requestBusy !== null || !patientId}
                onClick={() =>
                  sendPatientRequest(
                    "Billing / balance",
                    "I need help with an outstanding balance or billing question."
                  )
                }
              >
                Pay outstanding balance
              </Button>
            </>
          }
        />
        <PatientMiniCalendar appointments={appointments} />
        <PatientCareTeamMini members={careTeamMembers} />
      </aside>

      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">Result detail · {selectedResult.type}</CardTitle>
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

      {openThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">Provider Messages · {openThread.subject}</CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setOpenThreadKey(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto">
              <div className="space-y-2">
                {openThread.messages.map((msg) => {
                  const fromProvider = /^Provider Reply:/i.test(msg.title || "");
                  const senderLabel = fromProvider
                    ? msg.created_by_name || msg.owner_name || "Provider"
                    : currentPatientName;
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-lg border px-3 py-2 ${
                        fromProvider
                          ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20"
                          : "border-slate-200 bg-slate-50 dark:border-border dark:bg-muted/40"
                      }`}
                    >
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {fromProvider ? "From provider" : "You"}: {senderLabel}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                        {msg.details || "No message body."}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {format(new Date(msg.created_at), "MM/dd/yyyy HH:mm")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
