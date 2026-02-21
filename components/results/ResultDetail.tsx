"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";

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
  const [releaseHold, setReleaseHold] = useState(Boolean(result.patient_release_hold));
  const [releaseHoldReason, setReleaseHoldReason] = useState(result.patient_release_hold_reason || "");
  const canAcknowledge = hasRolePermission(currentUserRole, "acknowledge_result");

  const valueDisplay =
    typeof result.value === "object" && result.value
      ? JSON.stringify(result.value, null, 2)
      : String(result.value);

  const renderResultValue = () => {
    if (!result.value || typeof result.value !== "object" || Array.isArray(result.value)) {
      return (
        <pre className="text-sm bg-gray-50 dark:bg-muted dark:text-foreground p-3 rounded overflow-x-auto whitespace-pre-wrap">
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
        <div className="rounded border border-slate-200 dark:border-border">
          <div className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-3 py-2 text-xs font-medium text-slate-600 dark:text-muted-foreground">
            {typeof record.panel_label === "string" ? record.panel_label : "Lab Panel"}
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500 dark:text-muted-foreground">No analyte values documented.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map(([key, rawValue]) => {
                const flag = typeof flags[key] === "string" ? String(flags[key]) : "unknown";
                const badgeClass =
                  flag === "normal"
                    ? "bg-emerald-50 text-emerald-700"
                    : flag.includes("critical")
                    ? "bg-red-50 text-red-700"
                    : flag.includes("abnormal")
                    ? "bg-amber-50 text-amber-700"
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
                  <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-700 dark:text-foreground">{key.replaceAll("_", " ")}</span>
                    <div className="flex items-center gap-2">
                      <span>{String(rawValue)}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${badgeClass}`}>{flagLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {typeof record.comments === "string" && record.comments.trim() && (
            <p className="border-t border-slate-200 dark:border-border px-3 py-2 text-xs text-slate-600 dark:text-muted-foreground">
              {record.comments}
            </p>
          )}
        </div>
      );
    }

    const simplePairs = Object.entries(record).filter(([k]) => k !== "format");
    if (simplePairs.length > 0 && simplePairs.length <= 8) {
      return (
        <div className="rounded border border-slate-200 dark:border-border">
          <div className="divide-y divide-slate-100 dark:divide-border">
            {simplePairs.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-foreground">{key.replaceAll("_", " ")}</span>
                <span className="text-slate-700 dark:text-foreground">{typeof val === "string" ? val : JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <pre className="text-sm bg-gray-50 dark:bg-muted dark:text-foreground p-3 rounded overflow-x-auto whitespace-pre-wrap">
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

  const updatePatientRelease = async (release: boolean) => {
    setSaving(true);
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
    const payload = release
      ? {
          released_to_patient: true,
          released_to_patient_at: new Date().toISOString(),
          released_to_patient_by: user.id,
          released_to_patient_by_name: actorName,
          patient_release_hold: false,
          patient_release_hold_reason: null,
        }
      : {
          released_to_patient: false,
          released_to_patient_at: null,
          released_to_patient_by: null,
          released_to_patient_by_name: null,
          patient_release_hold: releaseHold,
          patient_release_hold_reason: releaseHold ? releaseHoldReason.trim() || "Hold" : null,
        };
    const { error } = await supabase.from("results").update(payload).eq("id", result.id);
    setSaving(false);
    if (error) {
      setUpdateError(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="border-b border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold capitalize text-slate-900 dark:text-foreground">{result.type}</span>
              {result.is_critical && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Critical
                </span>
              )}
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                  result.status === "final"
                    ? "bg-emerald-100 text-emerald-800"
                    : result.status === "preliminary"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 dark:bg-secondary text-slate-700 dark:text-foreground"
                }`}
              >
                {result.status}
              </span>
            </div>
            <span className="text-sm text-slate-600 dark:text-muted-foreground">
              {format(new Date(result.reported_at), "MM/dd/yyyy HH:mm")}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {renderResultValue()}

          {result.critical_reason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm font-medium text-amber-900">Critical reason</p>
              <p className="text-sm text-amber-800">{result.critical_reason}</p>
            </div>
          )}

          {updateError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {updateError}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-slate-100 dark:bg-secondary px-2 py-1 font-medium text-slate-700 dark:text-foreground">
              {(result.acknowledgment_status || "new").toUpperCase()}
            </span>
            {result.acknowledged_by_name && result.acknowledged_at && (
              <span className="text-slate-600 dark:text-muted-foreground">
                Reviewed by {result.acknowledged_by_name} · {format(new Date(result.acknowledged_at), "MM/dd HH:mm")}
              </span>
            )}
            {result.actioned_by_name && result.actioned_at && (
              <span className="text-slate-600 dark:text-muted-foreground">
                Actioned by {result.actioned_by_name} · {format(new Date(result.actioned_at), "MM/dd HH:mm")}
              </span>
            )}
            {typeof result.reviewed_latency_minutes === "number" && (
              <span className="rounded-md bg-sky-100 px-2 py-1 text-sky-800">TAT: {result.reviewed_latency_minutes}m</span>
            )}
            {result.released_to_patient ? (
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">Released</span>
            ) : (
              <span className="rounded-md bg-slate-100 dark:bg-secondary px-2 py-1 text-slate-600 dark:text-muted-foreground">Held</span>
            )}
          </div>

          {result.is_critical && (
            <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/50 p-4 space-y-4">
              <p className="text-sm font-medium text-slate-700 dark:text-foreground">
                Document review and action (required to mark as actioned)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Reviewed note</span>
                  <textarea
                    className="min-h-[72px] w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background p-2 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={reviewedNote}
                    onChange={(e) => setReviewedNote(e.target.value)}
                    placeholder="Interpretation, who was notified"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Action note</span>
                  <textarea
                    className="min-h-[72px] w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background p-2 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Treatment changes, escalation, callback"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-foreground">
                <input
                  type="checkbox"
                  checked={callbackDocumented}
                  onChange={(e) => setCallbackDocumented(e.target.checked)}
                  className="rounded border-slate-300 dark:border-input"
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

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-border">
            <Button
            size="sm"
            variant="outline"
            disabled={saving || !canAcknowledge}
            onClick={() => updateAcknowledgment("reviewed")}
            title={!canAcknowledge ? `${formatRoleLabel(currentUserRole)} cannot acknowledge results` : undefined}
          >
              Mark Reviewed
            </Button>
            <Button
            size="sm"
            variant="outline"
            disabled={saving || !canAcknowledge}
            onClick={() => updateAcknowledgment("actioned")}
            title={!canAcknowledge ? `${formatRoleLabel(currentUserRole)} cannot action results` : undefined}
          >
              Mark Actioned
            </Button>
            <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => updatePatientRelease(true)}
          >
              Release to Patient
            </Button>
            <Button
            size="sm"
            variant="outline"
            disabled={saving || !releaseHold}
            onClick={() => updatePatientRelease(false)}
          >
              Save Hold
            </Button>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-foreground">
            <input
              type="checkbox"
              checked={releaseHold}
              onChange={(e) => setReleaseHold(e.target.checked)}
            />
              Hold from patient portal
            </label>
            {releaseHold && (
              <input
              className="h-8 rounded border border-slate-300 dark:border-input bg-background px-2 text-xs text-foreground"
              value={releaseHoldReason}
              onChange={(e) => setReleaseHoldReason(e.target.value)}
              placeholder="Hold reason"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
