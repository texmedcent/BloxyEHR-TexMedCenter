"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckSquare, Clock, Pill, X } from "lucide-react";
import { getMedicationName } from "@/lib/orders";

interface MedicationAdminLogModalProps {
  order: {
    id: string;
    patient_id: string;
    details: unknown;
    next_due_at?: string | null;
    administration_frequency?: string | null;
    is_controlled_substance?: boolean;
    high_risk_med?: boolean;
    pharmacy_verified_at?: string | null;
  };
  bypassPharmacyVerification?: boolean;
  onLogged?: () => void;
  onClose: () => void;
}

interface AdminLogRow {
  id: string;
  event_type: "administered" | "not_given";
  event_at: string;
  reason: string | null;
  documented_by_name: string | null;
  scheduled_for: string | null;
  was_overdue: boolean;
  dose_given: string | null;
  route_given: string | null;
  witness_by_name: string | null;
  cosigned_at: string | null;
}

function toLocalDateTimeInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

export function MedicationAdminLogModal({ order, bypassPharmacyVerification = false, onLogged, onClose }: MedicationAdminLogModalProps) {
  const [rows, setRows] = useState<AdminLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventType, setEventType] = useState<"administered" | "not_given">("administered");
  const [eventAt, setEventAt] = useState(toLocalDateTimeInput(new Date()));
  const [scheduledFor, setScheduledFor] = useState(
    order.next_due_at ? toLocalDateTimeInput(new Date(order.next_due_at)) : toLocalDateTimeInput(new Date())
  );
  const [doseGiven, setDoseGiven] = useState("");
  const [routeGiven, setRouteGiven] = useState("");
  const [rightPatient, setRightPatient] = useState(false);
  const [rightMedication, setRightMedication] = useState(false);
  const [rightDose, setRightDose] = useState(false);
  const [rightRoute, setRightRoute] = useState(false);
  const [rightTime, setRightTime] = useState(false);
  const [witnessName, setWitnessName] = useState("");
  const [reason, setReason] = useState("");
  const [isHighRisk, setIsHighRisk] = useState(false);

  const medName = useMemo(() => getMedicationName(order.details), [order.details]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("med_admin_log")
      .select("id, event_type, event_at, reason, documented_by_name, scheduled_for, was_overdue, dose_given, route_given, witness_by_name, cosigned_at")
      .eq("order_id", order.id)
      .order("event_at", { ascending: false })
      .limit(50);
    setRows((data || []) as AdminLogRow[]);
    setLoading(false);
  }, [order.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (order.next_due_at) {
      setScheduledFor(toLocalDateTimeInput(new Date(order.next_due_at)));
    }
  }, [order.next_due_at]);

  useEffect(() => {
    if (order.is_controlled_substance != null || order.high_risk_med != null) {
      setIsHighRisk(Boolean(order.is_controlled_substance || order.high_risk_med));
    } else {
      const loadOrderRisk = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("orders")
          .select("is_controlled_substance, high_risk_med")
          .eq("id", order.id)
          .maybeSingle();
        setIsHighRisk(Boolean(data?.is_controlled_substance || data?.high_risk_med));
      };
      void loadOrderRisk();
    }
  }, [order.id, order.is_controlled_substance, order.high_risk_med]);

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setSaving(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const documentedByName =
      (profile?.full_name?.trim() as string) ||
      (user.email ? user.email.split("@")[0] : null) ||
      "Clinician";

    const needsPharmacyVerification =
      eventType === "administered" &&
      (order.is_controlled_substance || order.high_risk_med) &&
      !order.pharmacy_verified_at &&
      !bypassPharmacyVerification;

    if (needsPharmacyVerification) {
      setError(
        "This order requires pharmacist verification before administration. Please have a pharmacist verify it in the Pharmacist Panel."
      );
      setSaving(false);
      return;
    }

    const eventDate = new Date(eventAt);
    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(eventDate.getTime())) {
      setError("Invalid event time.");
      setSaving(false);
      return;
    }
    if (Number.isNaN(scheduledDate.getTime())) {
      setError("Invalid due time.");
      setSaving(false);
      return;
    }
    if (
      eventType === "administered" &&
      !(rightPatient && rightMedication && rightDose && rightRoute && rightTime)
    ) {
      setError("Complete all 5-rights checks before documenting administration.");
      setSaving(false);
      return;
    }
    if (isHighRisk && !witnessName.trim()) {
      setError("High-risk medications require witness/co-sign documentation.");
      setSaving(false);
      return;
    }
    const overdue =
      eventType === "administered" &&
      eventDate.getTime() - scheduledDate.getTime() > 30 * 60 * 1000;

    const { error: insertError } = await supabase.from("med_admin_log").insert({
      order_id: order.id,
      patient_id: order.patient_id,
      event_type: eventType,
      event_at: eventDate.toISOString(),
      scheduled_for: scheduledDate.toISOString(),
      was_overdue: overdue,
      dose_given: doseGiven.trim() || null,
      route_given: routeGiven.trim() || null,
      five_rights: {
        patient: rightPatient,
        medication: rightMedication,
        dose: rightDose,
        route: rightRoute,
        time: rightTime,
      },
      reason: reason.trim() || null,
      documented_by: user.id,
      documented_by_name: documentedByName,
      witness_by_name: witnessName.trim() || null,
      cosigned_at: isHighRisk && witnessName.trim() ? new Date().toISOString() : null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    // First documented administration event moves order out of pending.
    await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");

    setReason("");
    setEventType("administered");
    setEventAt(toLocalDateTimeInput(new Date()));
    setScheduledFor(toLocalDateTimeInput(new Date()));
    setDoseGiven("");
    setRouteGiven("");
    setRightPatient(false);
    setRightMedication(false);
    setRightDose(false);
    setRightRoute(false);
    setRightTime(false);
    setWitnessName("");
    void loadLogs();
    onLogged?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between shrink-0 border-slate-200 dark:border-border">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-foreground">
            <Pill className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
            eMAR / Administration Log{medName ? ` - ${medName}` : ""}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-auto">
          {order.administration_frequency && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 px-3 py-2">
              <Clock className="h-4 w-4 text-[#1a4d8c] dark:text-primary shrink-0" />
              <p className="text-sm text-slate-700 dark:text-foreground">
                <span className="font-medium">Frequency:</span> {order.administration_frequency}
                {order.next_due_at && (
                  <span className="text-slate-500 dark:text-muted-foreground">
                    {" "}· Next due {format(new Date(order.next_due_at), "MM/dd HH:mm")}
                  </span>
                )}
              </p>
            </div>
          )}
          <form onSubmit={saveEvent} className="space-y-4 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-slate-700 dark:text-foreground">Event Type</Label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as "administered" | "not_given")}
                  className="mt-1.5 h-9 w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                >
                  <option value="administered">Administered</option>
                  <option value="not_given">Not Given</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-700 dark:text-foreground">Scheduled Due Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-700 dark:text-foreground">Event Time</Label>
              <Input
                type="datetime-local"
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
                className="mt-1.5 max-w-xs"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-slate-700 dark:text-foreground">Dose Given</Label>
                <Input
                  value={doseGiven}
                  onChange={(e) => setDoseGiven(e.target.value)}
                  className="mt-1.5"
                  placeholder="e.g. 4 mg"
                />
              </div>
              <div>
                <Label className="text-slate-700 dark:text-foreground">Route Given</Label>
                <Input
                  value={routeGiven}
                  onChange={(e) => setRouteGiven(e.target.value)}
                  className="mt-1.5"
                  placeholder="e.g. IV"
                />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
                <CheckSquare className="h-3.5 w-3.5" />
                5 Rights Checklist
              </p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-foreground">
                  <input
                    type="checkbox"
                    checked={rightPatient}
                    onChange={(e) => setRightPatient(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-input text-[#1a4d8c] focus:ring-[#1a4d8c]"
                  />
                  Right patient verified
                </label>
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-foreground">
                  <input
                    type="checkbox"
                    checked={rightMedication}
                    onChange={(e) => setRightMedication(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-input text-[#1a4d8c] focus:ring-[#1a4d8c]"
                  />
                  Right medication verified
                </label>
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-foreground">
                  <input
                    type="checkbox"
                    checked={rightDose}
                    onChange={(e) => setRightDose(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-input text-[#1a4d8c] focus:ring-[#1a4d8c]"
                  />
                  Right dose verified
                </label>
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-foreground">
                  <input
                    type="checkbox"
                    checked={rightRoute}
                    onChange={(e) => setRightRoute(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-input text-[#1a4d8c] focus:ring-[#1a4d8c]"
                  />
                  Right route verified
                </label>
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-slate-700 dark:text-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={rightTime}
                    onChange={(e) => setRightTime(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-input text-[#1a4d8c] focus:ring-[#1a4d8c]"
                  />
                  Right time verified
                </label>
              </div>
            </div>
            {isHighRisk && (
              <div>
                <Label className="text-slate-700 dark:text-foreground">Witness / Co-sign (required for high-risk med)</Label>
                <Input
                  className="mt-1.5"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  placeholder="Enter witness full name"
                />
              </div>
            )}
            <div>
              <Label className="text-slate-700 dark:text-foreground">Reason / Notes</Label>
              <Textarea
                className="mt-1.5 min-h-[80px] rounded-md"
                placeholder="Document reason, refusal, hold parameters, or notes."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#1a4d8c] hover:bg-[#1a4d8c]/90 dark:bg-primary dark:hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Add Log Entry"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-foreground">
              Recent Administration Events
            </h3>
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-muted-foreground">Loading...</p>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-border py-8 text-center">
                <Pill className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
                <p className="text-sm text-slate-500 dark:text-muted-foreground">
                  No administration events logged yet.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-slate-200 dark:border-border p-3 text-sm bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          row.event_type === "administered"
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {row.event_type === "administered" ? "Administered" : "Not Given"}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-muted-foreground">
                        {format(new Date(row.event_at), "MM/dd/yyyy HH:mm")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {row.scheduled_for && (
                        <span className="rounded-md bg-slate-100 dark:bg-muted px-2 py-0.5 text-slate-700 dark:text-foreground text-xs">
                          Due {format(new Date(row.scheduled_for), "MM/dd HH:mm")}
                        </span>
                      )}
                      {row.was_overdue && (
                        <span className="rounded-md bg-red-50 dark:bg-red-950/50 px-2 py-0.5 text-red-700 dark:text-red-300 text-xs">
                          Overdue
                        </span>
                      )}
                      {row.dose_given && <span>Dose: {row.dose_given}</span>}
                      {row.route_given && <span>Route: {row.route_given}</span>}
                    </div>
                    {row.reason && (
                      <p className="mt-1.5 whitespace-pre-wrap text-slate-700 dark:text-foreground">{row.reason}</p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-muted-foreground">
                      Documented by {row.documented_by_name || "Clinician"}
                    </p>
                    {row.witness_by_name && (
                      <p className="text-xs text-slate-500 dark:text-muted-foreground">
                        Witness: {row.witness_by_name}
                        {row.cosigned_at
                          ? ` · ${format(new Date(row.cosigned_at), "MM/dd HH:mm")}`
                          : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
