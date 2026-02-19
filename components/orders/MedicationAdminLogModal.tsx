"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { getMedicationName } from "@/lib/orders";

interface MedicationAdminLogModalProps {
  order: {
    id: string;
    patient_id: string;
    details: unknown;
    next_due_at?: string | null;
    administration_frequency?: string | null;
  };
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

export function MedicationAdminLogModal({ order, onLogged, onClose }: MedicationAdminLogModalProps) {
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
  }, [order.id]);

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
      documented_by_name: profile?.full_name || user.email || "Clinician",
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
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <CardTitle>eMAR / Administration Log{medName ? ` - ${medName}` : ""}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-auto">
          {order.administration_frequency && (
            <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              Frequency: {order.administration_frequency}
              {order.next_due_at
                ? ` · Next due ${format(new Date(order.next_due_at), "MM/dd HH:mm")}`
                : ""}
            </p>
          )}
          <form onSubmit={saveEvent} className="space-y-3 rounded border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Event Type</Label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as "administered" | "not_given")}
                  className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="administered">Administered</option>
                  <option value="not_given">Not Given</option>
                </select>
              </div>
              <div>
                <Label>Scheduled Due Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Event Time</Label>
                <Input
                  type="datetime-local"
                  value={eventAt}
                  onChange={(e) => setEventAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Dose Given</Label>
                <Input
                  value={doseGiven}
                  onChange={(e) => setDoseGiven(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. 4 mg"
                />
              </div>
              <div>
                <Label>Route Given</Label>
                <Input
                  value={routeGiven}
                  onChange={(e) => setRouteGiven(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. IV"
                />
              </div>
            </div>
            <div className="rounded border border-slate-200 p-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Barcode-style 5 Rights Checklist
              </p>
              <div className="grid gap-1 text-xs md:grid-cols-2">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={rightPatient} onChange={(e) => setRightPatient(e.target.checked)} />
                  Right patient verified
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={rightMedication} onChange={(e) => setRightMedication(e.target.checked)} />
                  Right medication verified
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={rightDose} onChange={(e) => setRightDose(e.target.checked)} />
                  Right dose verified
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={rightRoute} onChange={(e) => setRightRoute(e.target.checked)} />
                  Right route verified
                </label>
                <label className="inline-flex items-center gap-2 md:col-span-2">
                  <input type="checkbox" checked={rightTime} onChange={(e) => setRightTime(e.target.checked)} />
                  Right time verified
                </label>
              </div>
            </div>
            {isHighRisk && (
              <div>
                <Label>Witness / Co-sign (required for high-risk med)</Label>
                <Input
                  className="mt-1"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  placeholder="Enter witness full name"
                />
              </div>
            )}
            <div>
              <Label>Reason / Notes</Label>
              <Textarea
                className="mt-1 min-h-[80px]"
                placeholder="Document reason, refusal, hold parameters, or notes."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Log Entry"}
              </Button>
            </div>
          </form>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Recent Administration Events</h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">No administration events logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.id} className="rounded border border-slate-200 p-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                          row.event_type === "administered"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.event_type === "administered" ? "Administered" : "Not Given"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(row.event_at), "MM/dd/yyyy HH:mm")}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {row.scheduled_for && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                          Due {format(new Date(row.scheduled_for), "MM/dd HH:mm")}
                        </span>
                      )}
                      {row.was_overdue && (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                          Overdue
                        </span>
                      )}
                      {row.dose_given && <span>Dose: {row.dose_given}</span>}
                      {row.route_given && <span>Route: {row.route_given}</span>}
                    </div>
                    {row.reason && <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.reason}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Documented by {row.documented_by_name || "Clinician"}
                    </p>
                    {row.witness_by_name && (
                      <p className="text-xs text-slate-500">
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
