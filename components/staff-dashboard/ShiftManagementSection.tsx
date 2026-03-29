"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, RefreshCw, Check, X } from "lucide-react";
import { format } from "date-fns";
import { isHospitalManager } from "@/lib/roles";

interface StaffShift {
  id: string;
  user_id: string;
  department: string | null;
  shift_type: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
}

interface ShiftSwapRequest {
  id: string;
  original_shift_id: string;
  requested_by_id: string;
  status: string;
  original_shift?: Pick<StaffShift, "shift_type" | "scheduled_start"> | null;
  requested_by_name?: string | null;
}

interface TimeEntry {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
}

interface ShiftManagementSectionProps {
  upcomingShifts: StaffShift[];
  swapRequests: ShiftSwapRequest[];
  latestTimeEntry: TimeEntry | null;
  currentUserId: string;
  currentUserRole: string | null;
}

export function ShiftManagementSection({
  upcomingShifts,
  swapRequests,
  latestTimeEntry,
  currentUserId,
  currentUserRole,
}: ShiftManagementSectionProps) {
  const router = useRouter();
  const [clocking, setClocking] = useState(false);
  const [clockMessage, setClockMessage] = useState<string | null>(null);
  const [timeTrackingUnavailable, setTimeTrackingUnavailable] = useState(false);
  const isManager = isHospitalManager(currentUserRole);
  const myShifts = upcomingShifts.filter((s) => s.user_id === currentUserId);
  const pendingSwapRequests = swapRequests.filter((r) => r.status === "pending");
  const isClockedIn = latestTimeEntry && !latestTimeEntry.clock_out_at;

  const handleClockError = (rawMessage: string) => {
    const msg = rawMessage || "Unknown error";
    if (msg.toLowerCase().includes("could not find the table 'public.staff_time_entries'")) {
      setTimeTrackingUnavailable(true);
      setClockMessage("Time tracking isn't configured in this project yet. Ask an admin to run staff dashboard migrations.");
      return;
    }
    setClockMessage(msg);
  };

  const clockIn = async () => {
    setClocking(true);
    setClockMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? currentUserId;
    if (!userId) {
      setClockMessage("Unable to clock in: no active user.");
      setClocking(false);
      return;
    }
    const { data: openEntry, error: openEntryError } = await supabase
      .from("staff_time_entries")
      .select("id")
      .eq("user_id", userId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openEntryError) {
      handleClockError(`Clock In failed: ${openEntryError.message}`);
      setClocking(false);
      return;
    }
    if (openEntry?.id) {
      setClockMessage("You are already clocked in.");
      setClocking(false);
      router.refresh();
      return;
    }
    const { error } = await supabase.from("staff_time_entries").insert({
      user_id: userId,
      clock_in_at: new Date().toISOString(),
    });
    if (error) {
      handleClockError(`Clock In failed: ${error.message}`);
      setClocking(false);
      return;
    }
    setClockMessage("Clocked in.");
    setClocking(false);
    router.refresh();
  };

  const clockOut = async () => {
    setClockMessage(null);
    if (!latestTimeEntry?.id) {
      setClockMessage("No active clock-in found.");
      return;
    }
    setClocking(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("staff_time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", latestTimeEntry.id);
    if (error) {
      handleClockError(`Clock Out failed: ${error.message}`);
      setClocking(false);
      return;
    }
    setClockMessage("Clocked out.");
    setClocking(false);
    router.refresh();
  };

  const resolveSwapRequest = async (requestId: string, approved: boolean) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("shift_swap_requests")
      .update({
        status: approved ? "approved" : "denied",
        resolved_by_id: user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    router.refresh();
  };

  const shiftTypeLabel = (t: string) =>
    t === "day" ? "Day" : t === "evening" ? "Evening" : t === "night" ? "Night" : t;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Shift Management
        </CardTitle>
        <CardDescription>Upcoming shifts, clock-in/out, and swap requests.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time Tracker
          </h4>
          {clockMessage ? <p className="mb-2 text-xs text-muted-foreground">{clockMessage}</p> : null}
          <div className="flex items-center gap-3">
            <Badge variant={isClockedIn ? "default" : "secondary"} className="text-sm">
              {isClockedIn
                ? `Clocked in since ${format(new Date(latestTimeEntry!.clock_in_at), "h:mm a")}`
                : "Not clocked in"}
            </Badge>
            {isClockedIn ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={clockOut}
                disabled={clocking || timeTrackingUnavailable}
              >
                Clock Out
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={clockIn}
                disabled={clocking || timeTrackingUnavailable}
              >
                Clock In
              </Button>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Upcoming Shifts</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {myShifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming shifts.</p>
            ) : (
              myShifts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{shiftTypeLabel(s.shift_type)}</span>
                    {s.department && (
                      <span className="text-muted-foreground ml-2">({s.department})</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.scheduled_start), "EEE, MMM d")} —{" "}
                      {format(new Date(s.scheduled_start), "h:mm a")} to{" "}
                      {format(new Date(s.scheduled_end), "h:mm a")}
                    </p>
                  </div>
                  <Badge variant="outline">{s.status}</Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {isManager && pendingSwapRequests.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              Pending Swap Requests
            </h4>
            <div className="space-y-2">
              {pendingSwapRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border p-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.requested_by_name || "Staff"}</span>
                    <p className="text-xs text-muted-foreground">
                      {r.original_shift
                        ? `${shiftTypeLabel(r.original_shift.shift_type)}: ${format(
                            new Date(r.original_shift.scheduled_start),
                            "MMM d"
                          )}`
                        : "Shift swap"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-600"
                      onClick={() => resolveSwapRequest(r.id, true)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => resolveSwapRequest(r.id, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
