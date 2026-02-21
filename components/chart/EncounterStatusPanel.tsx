"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";

interface EncounterStatusPanelProps {
  patientId: string;
  encounter: {
    id: string;
    status: string;
    admit_date?: string | null;
    workflow_status?: string | null;
    assigned_to?: string | null;
    assigned_to_name?: string | null;
    assigned_at?: string | null;
    encounter_display_id?: string | null;
    last_updated_by_name?: string | null;
    last_updated_at?: string | null;
    supervising_attending?: string | null;
    disposition_type?: string | null;
    discharge_instructions?: string | null;
    return_precautions?: string | null;
    follow_up_destination?: string | null;
    disposition_set_by_name?: string | null;
    disposition_set_at?: string | null;
    first_provider_seen_at?: string | null;
    first_med_ordered_at?: string | null;
    first_med_admin_at?: string | null;
  } | null;
  currentUser: {
    id: string;
    name: string;
    role: string | null;
  } | null;
  onUpdated?: () => void;
}

export function EncounterStatusPanel({
  patientId,
  encounter,
  currentUser,
  onUpdated,
}: EncounterStatusPanelProps) {
  const [encounterState, setEncounterState] = useState(encounter);
  const [savingAssign, setSavingAssign] = useState(false);
  const [savingAttending, setSavingAttending] = useState(false);
  const [savingDisposition, setSavingDisposition] = useState(false);
  const [savingAdverseEvent, setSavingAdverseEvent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attending, setAttending] = useState(encounterState?.supervising_attending || "");
  const [dispositionType, setDispositionType] = useState(encounterState?.disposition_type || "");
  const [dischargeInstructions, setDischargeInstructions] = useState(
    encounterState?.discharge_instructions || ""
  );
  const [returnPrecautions, setReturnPrecautions] = useState(encounterState?.return_precautions || "");
  const [followUpDestination, setFollowUpDestination] = useState(
    encounterState?.follow_up_destination || ""
  );
  const [adverseType, setAdverseType] = useState("medication");
  const [adverseSeverity, setAdverseSeverity] = useState("moderate");
  const [adverseDescription, setAdverseDescription] = useState("");
  const [auditRows, setAuditRows] = useState<
    { id: string; action: string; created_by_name: string | null; created_at: string }[]
  >([]);
  const [taskRows, setTaskRows] = useState<
    {
      id: string;
      title: string;
      owner_name: string | null;
      due_at: string | null;
      status: "open" | "in_progress" | "completed" | "cancelled";
      priority: "low" | "normal" | "high" | "critical";
      sla_violation: boolean;
      escalation_triggered_at: string | null;
    }[]
  >([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high" | "critical">(
    "normal"
  );
  const [savingTask, setSavingTask] = useState(false);
  const [savingAvs, setSavingAvs] = useState(false);
  const [latestAvs, setLatestAvs] = useState<{
    id: string;
    summary_text: string;
    created_by_name: string | null;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    setEncounterState(encounter);
    setAttending(encounter?.supervising_attending || "");
    setDispositionType(encounter?.disposition_type || "");
    setDischargeInstructions(encounter?.discharge_instructions || "");
    setReturnPrecautions(encounter?.return_precautions || "");
    setFollowUpDestination(encounter?.follow_up_destination || "");
  }, [encounter]);

  useEffect(() => {
    const loadAudit = async () => {
      if (!encounterState?.id) {
        setAuditRows([]);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("encounter_audit_log")
        .select("id, action, created_by_name, created_at")
        .eq("encounter_id", encounterState.id)
        .order("created_at", { ascending: false })
        .limit(6);
      setAuditRows((data || []) as { id: string; action: string; created_by_name: string | null; created_at: string }[]);
    };
    void loadAudit();
  }, [encounterState?.id]);

  useEffect(() => {
    const loadTasksAndAvs = async () => {
      if (!encounterState?.id) {
        setTaskRows([]);
        setLatestAvs(null);
        return;
      }
      const supabase = createClient();
      const { data: tasks } = await supabase
        .from("in_basket_tasks")
        .select("id, title, owner_name, due_at, status, priority, sla_violation, escalation_triggered_at")
        .eq("encounter_id", encounterState.id)
        .in("status", ["open", "in_progress"])
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(20);
      setTaskRows((tasks || []) as typeof taskRows);
      const { data: avs } = await supabase
        .from("encounter_avs")
        .select("id, summary_text, created_by_name, created_at")
        .eq("encounter_id", encounterState.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestAvs(avs || null);
    };
    void loadTasksAndAvs();
  }, [encounterState?.id]);

  if (!encounterState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Encounter Status Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            No encounter available yet. Start an encounter to track assignment and audit details.
          </p>
        </CardContent>
      </Card>
    );
  }

  const workflow = encounterState.workflow_status || "awaiting_provider";
  const assignedLabel = encounterState.assigned_to_name || "Unassigned";
  const encounterIdLabel =
    encounterState.encounter_display_id || `ENC-${encounterState.id.slice(0, 8).toUpperCase()}`;
  const canSetDisposition = hasRolePermission(currentUser?.role, "set_disposition");
  const elapsedMinutes = encounterState.admit_date
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(encounterState.admit_date).getTime()) / 60000)
      )
    : null;

  const logAudit = async (action: string, fieldChanges: Record<string, unknown>) => {
    if (!currentUser) return;
    const supabase = createClient();
    await supabase.from("encounter_audit_log").insert({
      encounter_id: encounterState.id,
      action,
      field_changes: fieldChanges,
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    });
  };

  const assignToMe = async () => {
    if (!currentUser) return;
    setSavingAssign(true);
    setMessage(null);
    const nowIso = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("encounters")
      .update({
        workflow_status: "in_progress",
        assigned_to: currentUser.id,
        assigned_to_name: currentUser.name,
        assigned_at: nowIso,
        last_updated_by: currentUser.id,
        last_updated_by_name: currentUser.name,
        last_updated_at: nowIso,
      })
      .eq("id", encounterState.id);

    setSavingAssign(false);
    if (error) {
      setMessage(`Failed to assign: ${error.message}`);
      return;
    }

    await logAudit("assigned_to_me", {
      assigned_to_name: currentUser.name,
      workflow_status: "in_progress",
      assigned_at: nowIso,
    });
    await supabase.from("recent_patients").upsert(
      {
        user_id: currentUser.id,
        patient_id: patientId,
        is_pinned: true,
        viewed_at: nowIso,
      },
      { onConflict: "user_id,patient_id" }
    );
    setEncounterState((prev) =>
      prev
        ? {
            ...prev,
            workflow_status: "in_progress",
            assigned_to: currentUser.id,
            assigned_to_name: currentUser.name,
            assigned_at: nowIso,
            last_updated_by_name: currentUser.name,
            last_updated_at: nowIso,
          }
        : prev
    );
    setMessage("Encounter assigned.");
    onUpdated?.();
  };

  const saveAttending = async () => {
    if (!currentUser) return;
    setSavingAttending(true);
    setMessage(null);
    const nowIso = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("encounters")
      .update({
        supervising_attending: attending.trim() || null,
        last_updated_by: currentUser.id,
        last_updated_by_name: currentUser.name,
        last_updated_at: nowIso,
      })
      .eq("id", encounterState.id);

    setSavingAttending(false);
    if (error) {
      setMessage(`Failed to update attending: ${error.message}`);
      return;
    }

    await logAudit("updated_supervising_attending", {
      supervising_attending: attending.trim() || null,
    });
    setEncounterState((prev) =>
      prev
        ? {
            ...prev,
            supervising_attending: attending.trim() || null,
            last_updated_by_name: currentUser.name,
            last_updated_at: nowIso,
          }
        : prev
    );
    setMessage("Supervising attending updated.");
    onUpdated?.();
  };

  const saveDisposition = async () => {
    if (!currentUser) return;
    if (!canSetDisposition) {
      setMessage(`Role ${formatRoleLabel(currentUser.role)} cannot set disposition.`);
      return;
    }
    setSavingDisposition(true);
    setMessage(null);
    const nowIso = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("encounters")
      .update({
        disposition_type: dispositionType || null,
        discharge_instructions: dischargeInstructions.trim() || null,
        return_precautions: returnPrecautions.trim() || null,
        follow_up_destination: followUpDestination.trim() || null,
        disposition_set_by: currentUser.id,
        disposition_set_by_name: currentUser.name,
        disposition_set_at: nowIso,
        last_updated_by: currentUser.id,
        last_updated_by_name: currentUser.name,
        last_updated_at: nowIso,
      })
      .eq("id", encounterState.id);

    setSavingDisposition(false);
    if (error) {
      setMessage(`Failed to update disposition: ${error.message}`);
      return;
    }

    await logAudit("updated_disposition", {
      disposition_type: dispositionType || null,
      follow_up_destination: followUpDestination || null,
    });

    setEncounterState((prev) =>
      prev
        ? {
            ...prev,
            disposition_type: dispositionType || null,
            discharge_instructions: dischargeInstructions.trim() || null,
            return_precautions: returnPrecautions.trim() || null,
            follow_up_destination: followUpDestination.trim() || null,
            disposition_set_by_name: currentUser.name,
            disposition_set_at: nowIso,
            last_updated_by_name: currentUser.name,
            last_updated_at: nowIso,
          }
        : prev
    );
    setMessage("Disposition updated.");
    onUpdated?.();
  };

  const reportAdverseEvent = async () => {
    if (!currentUser || !adverseDescription.trim()) return;
    setSavingAdverseEvent(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("adverse_events").insert({
      patient_id: patientId,
      encounter_id: encounterState.id,
      event_type: adverseType,
      severity: adverseSeverity,
      description: adverseDescription.trim(),
      reported_by: currentUser.id,
      reported_by_name: currentUser.name,
      status: "open",
    });
    setSavingAdverseEvent(false);
    if (error) {
      setMessage(`Failed to report adverse event: ${error.message}`);
      return;
    }
    setAdverseDescription("");
    setMessage("Adverse event reported.");
  };

  const addTask = async () => {
    if (!currentUser || !taskTitle.trim()) return;
    setSavingTask(true);
    const supabase = createClient();
    const dueDate = taskDueAt ? new Date(taskDueAt) : null;
    const { error } = await supabase.from("in_basket_tasks").insert({
      patient_id: patientId,
      encounter_id: encounterState.id,
      owner_id: currentUser.id,
      owner_name: currentUser.name,
      title: taskTitle.trim(),
      due_at: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null,
      priority: taskPriority,
      status: "open",
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    });
    setSavingTask(false);
    if (error) {
      setMessage(`Failed to add task: ${error.message}`);
      return;
    }
    setTaskTitle("");
    setTaskDueAt("");
    setTaskPriority("normal");
    setMessage("Task added.");
    onUpdated?.();
  };

  const completeTask = async (taskId: string) => {
    if (!currentUser) return;
    const supabase = createClient();
    await supabase
      .from("in_basket_tasks")
      .update({
        status: "completed",
        completed_by: currentUser.id,
        completed_by_name: currentUser.name,
        completed_at: new Date().toISOString(),
        completion_reason: "completed_from_encounter_status_panel",
      })
      .eq("id", taskId);
    setTaskRows((prev) => prev.filter((row) => row.id !== taskId));
  };

  const generateAvs = async () => {
    if (!currentUser) return;
    setSavingAvs(true);
    setMessage(null);
    const supabase = createClient();
    const { data: patient } = await supabase
      .from("patients")
      .select("first_name, last_name, mrn")
      .eq("id", patientId)
      .maybeSingle();
    const { data: meds } = await supabase
      .from("orders")
      .select("details, status")
      .eq("encounter_id", encounterState.id)
      .eq("type", "med")
      .neq("status", "discontinued");
    const { data: pendingTests } = await supabase
      .from("orders")
      .select("type, details, status")
      .eq("encounter_id", encounterState.id)
      .in("type", ["lab", "imaging"])
      .in("status", ["pending"]);

    const medLines = (meds || [])
      .map((m) => {
        const d =
          m.details && typeof m.details === "object" && !Array.isArray(m.details)
            ? (m.details as Record<string, unknown>)
            : {};
        const name = typeof d.medication === "string" ? d.medication : "Medication";
        const dose = typeof d.dose === "string" ? d.dose : "";
        const freq = typeof d.frequency === "string" ? d.frequency : "";
        return `- ${name}${dose ? ` ${dose}` : ""}${freq ? ` ${freq}` : ""}`;
      })
      .join("\n");
    const pendingLines = (pendingTests || [])
      .map((o) => {
        const d =
          o.details && typeof o.details === "object" && !Array.isArray(o.details)
            ? (o.details as Record<string, unknown>)
            : {};
        const label =
          typeof d.test === "string"
            ? d.test
            : typeof d.study === "string"
            ? d.study
            : o.type.toUpperCase();
        return `- ${label}`;
      })
      .join("\n");
    const dx = encounterState.disposition_type
      ? `Disposition: ${encounterState.disposition_type.replaceAll("_", " ")}`
      : "Disposition: Not documented";
    const summaryText = [
      `After Visit Summary (AVS)`,
      `Patient: ${patient?.last_name || "Patient"}, ${patient?.first_name || ""} (MRN ${patient?.mrn || "n/a"})`,
      "",
      `Diagnosis`,
      `- ${encounterState.disposition_type ? encounterState.disposition_type.replaceAll("_", " ") : "Not documented"}`,
      "",
      `Medications`,
      medLines || "- None",
      "",
      `Follow-up`,
      `- ${followUpDestination.trim() || "Follow up with primary care or specialty clinic as instructed."}`,
      "",
      `Return Precautions`,
      `- ${returnPrecautions.trim() || "Return for worsening symptoms, chest pain, trouble breathing, syncope, or other concerns."}`,
      "",
      `Pending Tests`,
      pendingLines || "- None",
      "",
      dx,
    ].join("\n");

    const { data, error } = await supabase
      .from("encounter_avs")
      .insert({
        encounter_id: encounterState.id,
        patient_id: patientId,
        summary_text: summaryText,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
      })
      .select("id, summary_text, created_by_name, created_at")
      .single();
    setSavingAvs(false);
    if (error) {
      setMessage(`Failed to generate AVS: ${error.message}`);
      return;
    }
    setLatestAvs(data);
    setMessage("AVS generated.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Encounter Status Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Encounter ID:</span>{" "}
            <span className="font-medium">{encounterIdLabel}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Status:</span>{" "}
            <span className="font-medium capitalize">{workflow.replaceAll("_", " ")}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Assigned To:</span>{" "}
            <span className="font-medium">{assignedLabel}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Timestamp:</span>{" "}
            <span className="font-medium">
              {encounterState.assigned_at
                ? format(new Date(encounterState.assigned_at), "MM/dd/yyyy HH:mm")
                : "—"}
            </span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Last Updated By:</span>{" "}
            <span className="font-medium">{encounterState.last_updated_by_name || "—"}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Encounter State:</span>{" "}
            <span className="font-medium capitalize">{encounterState.status}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Elapsed:</span>{" "}
            <span className="font-medium">{elapsedMinutes !== null ? `${elapsedMinutes} min` : "—"}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-muted-foreground">Disposition:</span>{" "}
            <span className="font-medium capitalize">
              {(encounterState.disposition_type || "not set").replaceAll("_", " ")}
            </span>
          </p>
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            ED Pathway Timers
          </p>
          <div className="grid gap-2 text-xs md:grid-cols-3">
            <p>
              Provider Seen:{" "}
              <span className="font-medium">
                {encounterState.first_provider_seen_at
                  ? format(new Date(encounterState.first_provider_seen_at), "MM/dd HH:mm")
                  : "—"}
              </span>
            </p>
            <p>
              First Med Ordered:{" "}
              <span className="font-medium">
                {encounterState.first_med_ordered_at
                  ? format(new Date(encounterState.first_med_ordered_at), "MM/dd HH:mm")
                  : "—"}
              </span>
            </p>
            <p>
              First Med Admin:{" "}
              <span className="font-medium">
                {encounterState.first_med_admin_at
                  ? format(new Date(encounterState.first_med_admin_at), "MM/dd HH:mm")
                  : "—"}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Discharge Packet / AVS
            </p>
            <Button size="sm" variant="outline" onClick={generateAvs} disabled={savingAvs}>
              {savingAvs ? "Generating..." : "Generate AVS"}
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-muted-foreground">
            Auto-generates diagnosis, meds, follow-up, return precautions, and pending tests.
          </p>
          {latestAvs && (
            <div className="mt-2 rounded bg-slate-50 dark:bg-muted p-2">
              <p className="mb-1 text-xs text-slate-500 dark:text-muted-foreground">
                Latest AVS by {latestAvs.created_by_name || "Clinician"} ·{" "}
                {format(new Date(latestAvs.created_at), "MM/dd HH:mm")}
              </p>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs">
                {latestAvs.summary_text}
              </pre>
            </div>
          )}
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Supervising Attending
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={attending}
              onChange={(e) => setAttending(e.target.value)}
              placeholder="e.g. D. Schlossberg, MD"
              className="max-w-sm"
            />
            <Button size="sm" variant="outline" onClick={saveAttending} disabled={savingAttending}>
              {savingAttending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Encounter Task Board
          </p>
          <div className="mb-2 grid gap-2 md:grid-cols-4">
            <Input
              className="md:col-span-2"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Reassess pain, redraw lactate, callback patient"
            />
            <Input
              type="datetime-local"
              value={taskDueAt}
              onChange={(e) => setTaskDueAt(e.target.value)}
            />
            <select
              value={taskPriority}
              onChange={(e) =>
                setTaskPriority(e.target.value as "low" | "normal" | "high" | "critical")
              }
              className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="mb-2">
            <Button size="sm" variant="outline" onClick={addTask} disabled={savingTask || !taskTitle.trim()}>
              {savingTask ? "Adding..." : "Add Task"}
            </Button>
          </div>
          {taskRows.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-muted-foreground">No open tasks for this encounter.</p>
          ) : (
            <ul className="space-y-1">
              {taskRows.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded bg-slate-50 dark:bg-muted px-2 py-1 text-xs">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-slate-500 dark:text-muted-foreground">
                      {task.owner_name || "Unassigned"}
                      {task.due_at ? ` · due ${format(new Date(task.due_at), "MM/dd HH:mm")}` : ""}
                      {` · ${task.priority}`}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {task.sla_violation && (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700">
                          SLA overdue
                        </span>
                      )}
                      {task.escalation_triggered_at && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                          Escalated
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => completeTask(task.id)}>
                    Complete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Disposition
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={dispositionType}
              onChange={(e) => setDispositionType(e.target.value)}
              className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
              disabled={!canSetDisposition || savingDisposition}
            >
              <option value="">Select disposition</option>
              <option value="admit">Admit</option>
              <option value="discharge">Discharge</option>
              <option value="transfer">Transfer</option>
              <option value="eloped">Eloped</option>
              <option value="ama">AMA</option>
              <option value="expired">Expired</option>
            </select>
            <Input
              value={followUpDestination}
              onChange={(e) => setFollowUpDestination(e.target.value)}
              placeholder="Follow-up destination"
              disabled={!canSetDisposition || savingDisposition}
            />
            <Textarea
              value={dischargeInstructions}
              onChange={(e) => setDischargeInstructions(e.target.value)}
              placeholder="Discharge instructions"
              className="md:col-span-2 min-h-[80px]"
              disabled={!canSetDisposition || savingDisposition}
            />
            <Textarea
              value={returnPrecautions}
              onChange={(e) => setReturnPrecautions(e.target.value)}
              placeholder="Return precautions"
              className="md:col-span-2 min-h-[80px]"
              disabled={!canSetDisposition || savingDisposition}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={saveDisposition}
              disabled={!canSetDisposition || savingDisposition}
            >
              {savingDisposition ? "Saving..." : "Save Disposition"}
            </Button>
            {!canSetDisposition && (
              <span className="text-xs text-amber-700">
                {formatRoleLabel(currentUser?.role)} cannot set disposition.
              </span>
            )}
            {encounterState.disposition_set_by_name && (
              <span className="text-xs text-slate-500 dark:text-muted-foreground">
                Last set by {encounterState.disposition_set_by_name}
                {encounterState.disposition_set_at
                  ? ` · ${format(new Date(encounterState.disposition_set_at), "MM/dd HH:mm")}`
                  : ""}
              </span>
            )}
          </div>
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Patient Safety Event
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={adverseType}
              onChange={(e) => setAdverseType(e.target.value)}
              className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
            >
              <option value="medication">Medication Event</option>
              <option value="fall">Fall</option>
              <option value="procedure">Procedure Complication</option>
              <option value="delay_in_care">Delay in Care</option>
              <option value="other">Other</option>
            </select>
            <select
              value={adverseSeverity}
              onChange={(e) => setAdverseSeverity(e.target.value)}
              className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
              <option value="sentinel">Sentinel</option>
            </select>
            <Textarea
              className="md:col-span-2 min-h-[70px]"
              value={adverseDescription}
              onChange={(e) => setAdverseDescription(e.target.value)}
              placeholder="Describe the event and immediate actions taken."
            />
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={reportAdverseEvent}
              disabled={savingAdverseEvent || !adverseDescription.trim()}
            >
              {savingAdverseEvent ? "Reporting..." : "Report Event"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={assignToMe}
            disabled={savingAssign || !currentUser}
            className="bg-[#1a4d8c] hover:bg-[#1a4d8c]/90"
          >
            {savingAssign ? "Assigning..." : "Assign to Me"}
          </Button>
          {message && <p className="text-xs text-slate-600 dark:text-muted-foreground">{message}</p>}
        </div>

        <div className="rounded border border-slate-200 dark:border-border p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Audit Trail
          </p>
          {auditRows.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-muted-foreground">No audit events yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {auditRows.map((row) => (
                <li key={row.id} className="rounded bg-slate-50 dark:bg-muted px-2 py-1">
                  <span className="font-medium">{row.action.replaceAll("_", " ")}</span>
                  {" · "}
                  {row.created_by_name || "Clinician"}
                  {" · "}
                  {format(new Date(row.created_at), "MM/dd HH:mm")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
