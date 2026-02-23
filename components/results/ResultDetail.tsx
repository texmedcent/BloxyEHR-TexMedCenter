"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";

interface ResultDetailProps {
  result: {
    id: string;
    type: string;
    value: unknown;
    reported_at: string;
    status: string;
    acknowledgment_status?: string;
    acknowledged_by_name?: string | null;
    acknowledged_at?: string | null;
    actioned_by_name?: string | null;
    actioned_at?: string | null;
    is_critical?: boolean;
    critical_reason?: string | null;
    reviewed_note?: string | null;
    action_note?: string | null;
    critical_callback_documented?: boolean;
    critical_callback_documented_at?: string | null;
    critical_callback_documented_by_name?: string | null;
    reviewed_latency_minutes?: number | null;
    action_latency_minutes?: number | null;
    escalation_triggered_at?: string | null;
    escalation_recipient_name?: string | null;
    sla_violation_reviewed?: boolean;
    sla_violation_actioned?: boolean;
    released_to_patient?: boolean;
    patient_release_hold?: boolean;
    patient_release_hold_reason?: string | null;
  };
  currentUserRole: string | null;
}

export function ResultDetail({ result, currentUserRole }: ResultDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [reviewedNote, setReviewedNote] = useState(result.reviewed_note || "");
  const [actionNote, setActionNote] = useState(result.action_note || "");
  const [callbackDocumented, setCallbackDocumented] = useState(
    Boolean(result.critical_callback_documented)
  );
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState(result.patient_release_hold_reason || "");
  const canAcknowledge = hasRolePermission(currentUserRole, "acknowledge_result");

  const valueDisplay =
    typeof result.value === "object" && result.value
      ? JSON.stringify(result.value, null, 2)
      : String(result.value);

  const renderResultValue = () => {
    if (!result.value || typeof result.value !== "object" || Array.isArray(result.value)) {
      return (
        <pre className="text-sm bg-slate-50 dark:bg-muted dark:text-foreground p-4 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-border">
          {valueDisplay}
        </pre>
      );
    }
    const record = result.value as Record<string, unknown>;
    if (record.format === "lab_panel_v1") {
      const values =
        record.values && typeof record.values === "object" && !Array.isArray(record.values)
          ? (record.values as Record<string, unknown>)
          : {};
      const flags =
        record.flags && typeof record.flags === "object" && !Array.isArray(record.flags)
          ? (record.flags as Record<string, unknown>)
          : {};
      const rows = Object.entries(values);
      return (
        <div className="rounded-lg border border-slate-200 dark:border-border overflow-hidden">
          <div className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-muted-foreground">
            {typeof record.panel_label === "string" ? record.panel_label : "Lab Panel"}
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-muted-foreground">No analyte values documented.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-border">
              {rows.map(([key, rawValue]) => {
                const flag = typeof flags[key] === "string" ? String(flags[key]) : "unknown";
                const badgeClass =
                  flag === "normal"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                    : flag.includes("critical")
                    ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                    : flag.includes("abnormal")
                    ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-secondary text-slate-600 dark:text-muted-foreground";
                const flagLabel =
                  flag === "critical_high"
                    ? "Critical High"
                    : flag === "critical_low"
                    ? "Critical Low"
                    : flag === "abnormal_high"
                    ? "High"
                    : flag === "abnormal_low"
                    ? "Low"
                    : flag === "normal"
                    ? "Normal"
                    : "Unrated";
                return (
                  <div key={key} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium text-slate-700 dark:text-foreground capitalize">{key.replaceAll("_", " ")}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-900 dark:text-foreground">{String(rawValue)}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{flagLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {typeof record.comments === "string" && record.comments.trim() && (
            <p className="border-t border-slate-200 dark:border-border px-4 py-2.5 text-sm text-slate-600 dark:text-muted-foreground">
              {record.comments}
            </p>
          )}
        </div>
      );
    }

    const simplePairs = Object.entries(record).filter(([k]) => k !== "format");
    if (simplePairs.length > 0 && simplePairs.length <= 8) {
      return (
        <div className="rounded-lg border border-slate-200 dark:border-border overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-border">
            {simplePairs.map(([key, val]) => (
              <div key={key} className="flex items-start gap-2 px-4 py-2.5 text-sm text-left">
                <span className="font-medium text-slate-700 dark:text-foreground capitalize shrink-0">{key.replaceAll("_", " ")}</span>
                <span className="text-slate-700 dark:text-foreground text-left">{typeof val === "string" ? val : JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <pre className="text-sm bg-slate-50 dark:bg-muted dark:text-foreground p-4 rounded-lg overflow-x-auto whitespace-pre-wrap border border-slate-200 dark:border-border">
        {valueDisplay}
      </pre>
    );
  };

  const updateAcknowledgment = async (nextStatus: "reviewed" | "actioned") => {
    if (!canAcknowledge) return;
    setSaving(true);
    setUpdateError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const actorName = profile?.full_name || user.email || "Clinician";
    const nowIso = new Date().toISOString();
    if (result.is_critical && nextStatus === "reviewed" && !reviewedNote.trim()) {
      setSaving(false);
      return;
    }
    if (result.is_critical && nextStatus === "actioned" && !actionNote.trim()) {
      setSaving(false);
      setUpdateError("Action note is required for critical results.");
      return;
    }

    const payload =
      nextStatus === "reviewed"
        ? {
            acknowledgment_status: "reviewed",
            acknowledged_by: user.id,
            acknowledged_by_name: actorName,
            acknowledged_at: nowIso,
            reviewed_note: reviewedNote.trim() || null,
            critical_callback_documented: callbackDocumented,
            critical_callback_documented_at: callbackDocumented ? nowIso : null,
            critical_callback_documented_by: callbackDocumented ? user.id : null,
            critical_callback_documented_by_name: callbackDocumented ? actorName : null,
          }
        : {
            acknowledgment_status: "actioned",
            actioned_by: user.id,
            actioned_by_name: actorName,
            actioned_at: nowIso,
            acknowledged_by: user.id,
            acknowledged_by_name: actorName,
            acknowledged_at: nowIso,
            reviewed_note: reviewedNote.trim() || null,
            action_note: actionNote.trim() || null,
            critical_callback_documented: callbackDocumented,
            critical_callback_documented_at: callbackDocumented ? nowIso : null,
            critical_callback_documented_by: callbackDocumented ? user.id : null,
            critical_callback_documented_by_name: callbackDocumented ? actorName : null,
          };

    const { error } = await supabase.from("results").update(payload).eq("id", result.id);
    setSaving(false);
    if (error) {
      setUpdateError(error.message);
      return;
    }
    router.refresh();
  };

  const releaseToPatient = async () => {
    setSaving(true);
    setUpdateError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const actorName = profile?.full_name || user.email || "Clinician";
    const { error } = await supabase
      .from("results")
      .update({
        released_to_patient: true,
        released_to_patient_at: new Date().toISOString(),
        released_to_patient_by: user.id,
        released_to_patient_by_name: actorName,
        patient_release_hold: false,
        patient_release_hold_reason: null,
      })
      .eq("id", result.id);
    setSaving(false);
    if (error) {
      setUpdateError(error.message);
      return;
    }
    router.refresh();
  };

  const holdFromPatient = async (reason: string) => {
    setSaving(true);
    setUpdateError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("results")
      .update({
        released_to_patient: false,
        released_to_patient_at: null,
        released_to_patient_by: null,
        released_to_patient_by_name: null,
        patient_release_hold: true,
        patient_release_hold_reason: reason.trim() || "Hold",
      })
      .eq("id", result.id);
    setSaving(false);
    if (error) {
      setUpdateError(error.message);
      return;
    }
    setHoldModalOpen(false);
    setHoldReason("");
    router.refresh();
  };

  return (
    <>
      <Card className="overflow-hidden border-slate-200 dark:border-border shadow-sm">
        <CardContent className="p-0">
          {/* Header */}
          <div className="border-b border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1a4d8c]/10 dark:bg-primary/20">
                  <FlaskConical className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-foreground capitalize">
                    {result.type} Result
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${
                        result.status === "final"
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                          : result.status === "preliminary"
                          ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                          : "bg-slate-200 dark:bg-secondary text-slate-700 dark:text-foreground"
                      }`}
                    >
                      {result.status}
                    </span>
                    {result.is_critical && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-950/50 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3" />
                        Critical
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(result.reported_at), "MM/dd/yyyy HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground mb-2">Result</p>
              {renderResultValue()}
            </div>

            {result.critical_reason && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Critical reason</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">{result.critical_reason}</p>
              </div>
            )}

            {updateError && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {updateError}
              </div>
            )}

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                  (result.acknowledgment_status || "new").toLowerCase() === "new"
                    ? "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300"
                    : (result.acknowledgment_status || "").toLowerCase() === "actioned"
                    ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-secondary text-slate-700 dark:text-foreground"
                }`}
              >
                {(result.acknowledgment_status || "new").toUpperCase()}
              </span>
              {result.released_to_patient ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Released
                </span>
              ) : result.patient_release_hold ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <Lock className="h-3.5 w-3.5" />
                  Held
                  {result.patient_release_hold_reason && (
                    <span className="text-amber-700 dark:text-amber-400">· {result.patient_release_hold_reason}</span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-secondary px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Not released
                </span>
              )}
              {result.acknowledged_by_name && result.acknowledged_at && (
                <span className="text-xs text-slate-500 dark:text-muted-foreground">
                  Reviewed by {result.acknowledged_by_name} · {format(new Date(result.acknowledged_at), "MM/dd HH:mm")}
                </span>
              )}
              {result.actioned_by_name && result.actioned_at && (
                <span className="text-xs text-slate-500 dark:text-muted-foreground">
                  Actioned by {result.actioned_by_name} · {format(new Date(result.actioned_at), "MM/dd HH:mm")}
                </span>
              )}
              {typeof result.reviewed_latency_minutes === "number" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 dark:bg-sky-950/50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:text-sky-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  TAT: {result.reviewed_latency_minutes}m
                </span>
              )}
            </div>

            {result.is_critical && (
              <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-4 space-y-4">
                <p className="text-sm font-medium text-slate-700 dark:text-foreground">
                  Document review and action (required to mark as actioned)
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Reviewed note</span>
                    <textarea
                      className="min-h-[72px] w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background p-2.5 text-sm"
                      value={reviewedNote}
                      onChange={(e) => setReviewedNote(e.target.value)}
                      placeholder="Interpretation, who was notified"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Action note</span>
                    <textarea
                      className="min-h-[72px] w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background p-2.5 text-sm"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="Treatment changes, escalation, callback"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 dark:text-foreground">
                  <input
                    type="checkbox"
                    checked={callbackDocumented}
                    onChange={(e) => setCallbackDocumented(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-input text-[#1a4d8c]"
                  />
                  Critical callback documented
                </label>
                {result.critical_callback_documented_by_name && result.critical_callback_documented_at && (
                  <p className="text-xs text-slate-600 dark:text-muted-foreground">
                    By {result.critical_callback_documented_by_name} · {format(new Date(result.critical_callback_documented_at), "MM/dd HH:mm")}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200 dark:border-border">
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={saving || !canAcknowledge}
                onClick={() => updateAcknowledgment("reviewed")}
                title={!canAcknowledge ? `${formatRoleLabel(currentUserRole)} cannot acknowledge results` : undefined}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={saving || !canAcknowledge}
                onClick={() => updateAcknowledgment("actioned")}
                title={!canAcknowledge ? `${formatRoleLabel(currentUserRole)} cannot action results` : undefined}
              >
                Mark Actioned
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={saving}
                onClick={releaseToPatient}
              >
                Release to Patient
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={saving}
                onClick={() => {
                  setHoldReason(result.patient_release_hold_reason || "");
                  setHoldModalOpen(true);
                }}
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                {result.patient_release_hold ? "Update Hold" : "Hold from Patient"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hold from Patient modal */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-foreground">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                Hold from Patient
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setHoldModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-muted-foreground">
                Why are you holding this result from the patient portal?
              </p>
              <div>
                <Label htmlFor="hold-reason" className="text-slate-700 dark:text-foreground">Reason (required)</Label>
                <Textarea
                  id="hold-reason"
                  className="mt-1.5 min-h-[100px] rounded-lg"
                  placeholder="e.g. Awaiting provider review before patient disclosure"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-lg" onClick={() => setHoldModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-lg"
                  disabled={saving || !holdReason.trim()}
                  onClick={() => holdFromPatient(holdReason)}
                >
                  {saving ? "Saving..." : "Confirm Hold"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
