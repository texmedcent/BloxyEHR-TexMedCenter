"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addProviderToCareTeam } from "@/lib/care_team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";
import {
  UserPlus,
  Users,
  Clock,
  FileText,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Stethoscope,
} from "lucide-react";

interface CareTeamMember {
  provider_id: string;
  full_name: string | null;
  added_at: string;
  added_via: string;
}

const ADDED_VIA_LABELS: Record<string, string> = {
  encounter_assign: "Assigned",
  encounter_edit: "Edited encounter",
  documentation: "Documentation",
  order: "Order",
  disposition: "Disposition",
};

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

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-3">{children}</div>}
    </div>
  );
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
      status: string;
      priority: string;
      sla_violation: boolean;
      escalation_triggered_at: string | null;
    }[]
  >([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [savingTask, setSavingTask] = useState(false);
  const [savingAvs, setSavingAvs] = useState(false);
  const [latestAvs, setLatestAvs] = useState<{
    id: string;
    summary_text: string;
    created_by_name: string | null;
    created_at: string;
  } | null>(null);
  const [careTeamMembers, setCareTeamMembers] = useState<CareTeamMember[]>([]);

  useEffect(() => {
    setEncounterState(encounter);
    setAttending(encounter?.supervising_attending || "");
    setDispositionType(encounter?.disposition_type || "");
    setDischargeInstructions(encounter?.discharge_instructions || "");
    setReturnPrecautions(encounter?.return_precautions || "");
    setFollowUpDestination(encounter?.follow_up_destination || "");
  }, [encounter]);

  useEffect(() => {
    const loadCareTeam = async () => {
      if (!patientId) return;
      const supabase = createClient();
      try {
        const { data: careRows } = await supabase
          .from("patient_care_team")
          .select("provider_id, added_at, added_via")
          .eq("patient_id", patientId)
          .order("added_at", { ascending: false });

        const { data: encounters } = await supabase
          .from("encounters")
          .select("assigned_to, assigned_to_name, assigned_at")
          .eq("patient_id", patientId)
          .not("assigned_to", "is", null);

        const providerIds = [
          ...new Set([
            ...(careRows || []).map((r) => r.provider_id),
            ...(encounters || []).map((e) => e.assigned_to).filter(Boolean) as string[],
          ]),
        ];

        const { data: profiles } =
          providerIds.length > 0
            ? await supabase.from("profiles").select("id, full_name").in("id", providerIds)
            : { data: [] };
        const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

        const members: CareTeamMember[] = (careRows || []).map((r) => ({
          provider_id: r.provider_id,
          full_name: profileMap.get(r.provider_id) || null,
          added_at: r.added_at,
          added_via: r.added_via,
        }));

        const inCareTeam = new Set(members.map((m) => m.provider_id));
        for (const enc of encounters || []) {
          const id = enc.assigned_to;
          if (id && !inCareTeam.has(id)) {
            members.push({
              provider_id: id,
              full_name: enc.assigned_to_name || profileMap.get(id) || null,
              added_at: enc.assigned_at || new Date().toISOString(),
              added_via: "encounter_assign",
            });
          }
        }

        setCareTeamMembers(
          Array.from(new Map(members.map((m) => [m.provider_id, m])).values()).sort(
            (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
          )
        );
      } catch {
        setCareTeamMembers([]);
      }
    };
    void loadCareTeam();
  }, [patientId]);

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
      setAuditRows((data || []) as typeof auditRows);
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
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-8 text-center">
        <Stethoscope className="mx-auto h-12 w-12 text-slate-300 dark:text-muted-foreground mb-3" />
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          No encounter selected. Pick an encounter from the history to view and manage its status.
        </p>
      </div>
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
  const isAssignedToMe = currentUser && encounterState.assigned_to === currentUser.id;

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
    await addProviderToCareTeam(supabase, patientId, "encounter_assign");
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
    setMessage("You're now assigned to this encounter.");
    onUpdated?.();
    setCareTeamMembers((prev) => {
      const next = [...prev.filter((m) => m.provider_id !== currentUser.id)];
      next.unshift({
        provider_id: currentUser.id,
        full_name: currentUser.name,
        added_at: nowIso,
        added_via: "encounter_assign",
      });
      return next;
    });
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

    await logAudit("updated_supervising_attending", { supervising_attending: attending.trim() || null });
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
    setMessage("Disposition saved.");
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
    <div className="space-y-4">
      {/* Quick actions & status summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-slate-100 dark:bg-muted/50 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500 dark:text-muted-foreground">
              {encounterIdLabel}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                workflow === "in_progress"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                  : "bg-slate-200 text-slate-700 dark:bg-muted dark:text-muted-foreground"
              }`}
            >
              {workflow.replaceAll("_", " ")}
            </span>
            {elapsedMinutes !== null && (
              <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {elapsedMinutes} min
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-foreground">
            Assigned to: {assignedLabel}
          </p>
          {encounterState.assigned_at && (
            <p className="text-xs text-slate-500 dark:text-muted-foreground">
              {format(new Date(encounterState.assigned_at), "MMM d, yyyy · h:mm a")}
            </p>
          )}
        </div>
        {!isAssignedToMe && currentUser && (
          <Button
            onClick={assignToMe}
            disabled={savingAssign}
            className="bg-[#1a4d8c] hover:bg-[#1a4d8c]/90 shrink-0"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {savingAssign ? "Assigning…" : "Assign to Me"}
          </Button>
        )}
        {isAssignedToMe && (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            You&apos;re assigned
          </div>
        )}
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            message.startsWith("Failed")
              ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
              : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
          }`}
        >
          {message.startsWith("Failed") ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {message}
        </div>
      )}

      {/* Care Team */}
      <CollapsibleSection title="Care Team" icon={Users} defaultOpen={true}>
        {careTeamMembers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            No providers on care team yet. Assign yourself or document to add.
          </p>
        ) : (
          <ul className="space-y-2">
            {careTeamMembers.map((m) => (
              <li
                key={m.provider_id}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-200/50 dark:border-border/50 last:border-0"
              >
                <span className="font-medium text-sm">
                  {m.full_name || "Provider"}
                  {m.provider_id === currentUser?.id && (
                    <span className="ml-1.5 text-xs text-slate-500 dark:text-muted-foreground">(you)</span>
                  )}
                </span>
                <span className="text-xs text-slate-500 dark:text-muted-foreground">
                  {ADDED_VIA_LABELS[m.added_via] || m.added_via} · {format(new Date(m.added_at), "MM/dd")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {/* Discharge / AVS */}
      <CollapsibleSection title="Discharge Packet & AVS" icon={FileText} defaultOpen={true}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={generateAvs} disabled={savingAvs}>
            {savingAvs ? "Generating…" : "Generate AVS"}
          </Button>
          <span className="text-xs text-slate-500 dark:text-muted-foreground">
            Diagnosis, meds, follow-up, return precautions
          </span>
        </div>
        {latestAvs && (
          <div className="rounded-lg bg-white dark:bg-card border border-slate-200 dark:border-border p-3">
            <p className="text-xs text-slate-500 dark:text-muted-foreground mb-2">
              By {latestAvs.created_by_name || "Clinician"} ·{" "}
              {format(new Date(latestAvs.created_at), "MM/dd HH:mm")}
            </p>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs">
              {latestAvs.summary_text}
            </pre>
          </div>
        )}
      </CollapsibleSection>

      {/* Supervising Attending */}
      <CollapsibleSection title="Supervising Attending" icon={Stethoscope} defaultOpen={false}>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={attending}
            onChange={(e) => setAttending(e.target.value)}
            placeholder="e.g. D. Schlossberg, MD"
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={saveAttending} disabled={savingAttending}>
            {savingAttending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CollapsibleSection>

      {/* Tasks */}
      <CollapsibleSection title="Tasks" icon={ClipboardList} defaultOpen={true}>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 mb-3">
          <Input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="e.g. Reassess pain, redraw lactate"
            className="sm:col-span-2"
          />
          <Input
            type="datetime-local"
            value={taskDueAt}
            onChange={(e) => setTaskDueAt(e.target.value)}
            className="text-sm"
          />
          <select
            value={taskPriority}
            onChange={(e) =>
              setTaskPriority(e.target.value as "low" | "normal" | "high" | "critical")
            }
            className="h-9 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={addTask}
          disabled={savingTask || !taskTitle.trim()}
          className="mb-3"
        >
          {savingTask ? "Adding…" : "Add Task"}
        </Button>
        {taskRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">No open tasks.</p>
        ) : (
          <ul className="space-y-2">
            {taskRows.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-border p-2 bg-white dark:bg-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">
                    {task.owner_name || "Unassigned"}
                    {task.due_at ? ` · due ${format(new Date(task.due_at), "MM/dd HH:mm")}` : ""} · {task.priority}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => completeTask(task.id)}>
                  Complete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {/* Disposition */}
      <CollapsibleSection title="Disposition" icon={CalendarCheck} defaultOpen={true}>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={dispositionType}
            onChange={(e) => setDispositionType(e.target.value)}
            className="h-9 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
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
            className="sm:col-span-2 min-h-[80px]"
            disabled={!canSetDisposition || savingDisposition}
          />
          <Textarea
            value={returnPrecautions}
            onChange={(e) => setReturnPrecautions(e.target.value)}
            placeholder="Return precautions"
            className="sm:col-span-2 min-h-[80px]"
            disabled={!canSetDisposition || savingDisposition}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={saveDisposition}
            disabled={!canSetDisposition || savingDisposition}
          >
            {savingDisposition ? "Saving…" : "Save Disposition"}
          </Button>
          {!canSetDisposition && (
            <span className="text-xs text-amber-600 dark:text-amber-500">
              {formatRoleLabel(currentUser?.role)} cannot set disposition
            </span>
          )}
          {encounterState.disposition_set_by_name && (
            <span className="text-xs text-slate-500 dark:text-muted-foreground">
              Last set by {encounterState.disposition_set_by_name}
              {encounterState.disposition_set_at &&
                ` · ${format(new Date(encounterState.disposition_set_at), "MM/dd HH:mm")}`}
            </span>
          )}
        </div>
      </CollapsibleSection>

      {/* ED Pathway Timers */}
      <CollapsibleSection title="ED Pathway Timers" icon={Clock} defaultOpen={false}>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <p>
            Provider seen:{" "}
            <span className="font-medium">
              {encounterState.first_provider_seen_at
                ? format(new Date(encounterState.first_provider_seen_at), "MM/dd HH:mm")
                : "—"}
            </span>
          </p>
          <p>
            First med ordered:{" "}
            <span className="font-medium">
              {encounterState.first_med_ordered_at
                ? format(new Date(encounterState.first_med_ordered_at), "MM/dd HH:mm")
                : "—"}
            </span>
          </p>
          <p>
            First med admin:{" "}
            <span className="font-medium">
              {encounterState.first_med_admin_at
                ? format(new Date(encounterState.first_med_admin_at), "MM/dd HH:mm")
                : "—"}
            </span>
          </p>
        </div>
      </CollapsibleSection>

      {/* Patient Safety Event */}
      <CollapsibleSection title="Patient Safety Event" icon={AlertTriangle} defaultOpen={false}>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={adverseType}
            onChange={(e) => setAdverseType(e.target.value)}
            className="h-9 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
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
            className="h-9 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="sentinel">Sentinel</option>
          </select>
          <Textarea
            className="sm:col-span-2 min-h-[70px]"
            value={adverseDescription}
            onChange={(e) => setAdverseDescription(e.target.value)}
            placeholder="Describe the event and immediate actions taken."
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={reportAdverseEvent}
          disabled={savingAdverseEvent || !adverseDescription.trim()}
          className="mt-2"
        >
          {savingAdverseEvent ? "Reporting…" : "Report Event"}
        </Button>
      </CollapsibleSection>

      {/* Audit Trail */}
      <CollapsibleSection title="Audit Trail" icon={FileText} defaultOpen={false}>
        {auditRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {auditRows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg bg-slate-100 dark:bg-muted/50 px-2 py-1.5"
              >
                <span className="font-medium">{row.action.replaceAll("_", " ")}</span>
                {" · "}
                {row.created_by_name || "Clinician"}
                {" · "}
                {format(new Date(row.created_at), "MM/dd HH:mm")}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    </div>
  );
}
