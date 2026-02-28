"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface StaffMember {
  id: string;
  full_name: string | null;
  department: string | null;
}

interface Shift {
  id: string;
  user_id: string;
  department: string | null;
  shift_type: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  staff_name?: string | null;
}

interface AdminShiftsSectionProps {
  staff: StaffMember[];
  upcomingShifts: Shift[];
}

const SHIFT_TYPES = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
];

export function AdminShiftsSection({ staff, upcomingShifts }: AdminShiftsSectionProps) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [department, setDepartment] = useState("");
  const [shiftType, setShiftType] = useState<"day" | "evening" | "night">("day");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createShift = async () => {
    if (!userId || !scheduledStart || !scheduledEnd) {
      setError("Staff member and dates are required.");
      return;
    }
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    if (end <= start) {
      setError("End must be after start.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("staff_shifts").insert({
      user_id: userId,
      department: department.trim() || null,
      shift_type: shiftType,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: "scheduled",
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setUserId("");
    setDepartment("");
    setShiftType("day");
    setScheduledStart("");
    setScheduledEnd("");
    router.refresh();
  };

  const cancelShift = async (id: string) => {
    const supabase = createClient();
    await supabase.from("staff_shifts").update({ status: "cancelled" }).eq("id", id);
    router.refresh();
  };

  const sortedShifts = [...(upcomingShifts || [])].sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
  );

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <CalendarDays className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Create & Manage Shifts
        </CardTitle>
        <CardDescription>Assign shifts to staff members.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-4 space-y-3">
          <h4 className="text-sm font-medium">New Shift</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Staff Member</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select staff...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? "Unknown"} {s.department ? `(${s.department})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Department</label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. ED, ICU"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Shift Type</label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as "day" | "evening" | "night")}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {SHIFT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Start</label>
              <Input
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">End</label>
              <Input
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" onClick={createShift} disabled={saving} className="gap-1">
            <Plus className="h-4 w-4" />
            {saving ? "Creating..." : "Create Shift"}
          </Button>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Upcoming Shifts</h4>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {sortedShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming shifts.</p>
            ) : (
              sortedShifts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{s.staff_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {SHIFT_TYPES.find((t) => t.value === s.shift_type)?.label ?? s.shift_type}
                      {s.department ? ` · ${s.department}` : ""} ·{" "}
                      {format(new Date(s.scheduled_start), "EEE, MMM d, h:mm a")} –{" "}
                      {format(new Date(s.scheduled_end), "h:mm a")}
                    </p>
                  </div>
                  {s.status === "scheduled" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => cancelShift(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
