"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [reason, setReason] = useState("");

  const medName = useMemo(() => getMedicationName(order.details), [order.details]);

  const loadLogs = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("med_admin_log")
      .select("id, event_type, event_at, reason, documented_by_name")
      .eq("order_id", order.id)
      .order("event_at", { ascending: false })
      .limit(50);
    setRows((data || []) as AdminLogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadLogs();
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
    if (Number.isNaN(eventDate.getTime())) {
      setError("Invalid event time.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("med_admin_log").insert({
      order_id: order.id,
      patient_id: order.patient_id,
      event_type: eventType,
      event_at: eventDate.toISOString(),
      reason: reason.trim() || null,
      documented_by: user.id,
      documented_by_name: profile?.full_name || user.email || "Clinician",
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
                <Label>Event Time</Label>
                <Input
                  type="datetime-local"
                  value={eventAt}
                  onChange={(e) => setEventAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
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
                    {row.reason && <p className="mt-1 whitespace-pre-wrap text-slate-700">{row.reason}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Documented by {row.documented_by_name || "Clinician"}
                    </p>
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
