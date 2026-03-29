"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Briefcase, Inbox } from "lucide-react";
import { format } from "date-fns";

interface StaffDashboardOverviewProps {
  currentUserId: string;
  latestTimeEntry: { id: string; clock_in_at: string; clock_out_at: string | null } | null;
  weeklyClockedHours: number;
  nextShift: { shift_type: string; scheduled_start: string; scheduled_end: string } | null;
  loaStatus: "pending" | "approved" | "denied" | null;
  loaDates?: string;
}

function formatHours(hours: number): string {
  const clamped = Math.max(0, hours);
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function StaffDashboardOverview({
  currentUserId,
  latestTimeEntry,
  weeklyClockedHours,
  nextShift,
  loaStatus,
  loaDates,
}: StaffDashboardOverviewProps) {
  const router = useRouter();
  const [clocking, setClocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [timeTrackingUnavailable, setTimeTrackingUnavailable] = useState(false);
  const isClockedIn = latestTimeEntry && !latestTimeEntry.clock_out_at;

  const handleClockError = (rawMessage: string) => {
    const msg = rawMessage || "Unknown error";
    if (msg.toLowerCase().includes("could not find the table 'public.staff_time_entries'")) {
      setTimeTrackingUnavailable(true);
      setMessage("Time tracking isn't configured in this project yet. Ask an admin to run staff dashboard migrations.");
      return;
    }
    setMessage(msg);
  };

  const clockIn = async () => {
    setClocking(true);
    setMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? currentUserId;
    if (!userId) {
      setMessage("Unable to clock in: no active user.");
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
      setMessage("You are already clocked in.");
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
    setMessage("Clocked in.");
    setClocking(false);
    router.refresh();
  };

  const clockOut = async () => {
    setClocking(true);
    setMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? currentUserId;
    if (!userId) {
      setMessage("Unable to clock out: no active user.");
      setClocking(false);
      return;
    }
    let resolvedId = latestTimeEntry?.id ?? null;
    if (!resolvedId) {
      const { data: openEntry, error: openEntryError } = await supabase
        .from("staff_time_entries")
        .select("id")
        .eq("user_id", userId)
        .is("clock_out_at", null)
        .order("clock_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openEntryError) {
        handleClockError(`Clock Out failed: ${openEntryError.message}`);
        setClocking(false);
        return;
      }
      resolvedId = openEntry?.id ?? null;
    }
    if (!resolvedId) {
      setMessage("No active clock-in found.");
      setClocking(false);
      return;
    }
    const { error } = await supabase
      .from("staff_time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", resolvedId);
    if (error) {
      handleClockError(`Clock Out failed: ${error.message}`);
      setClocking(false);
      return;
    }
    setMessage("Clocked out.");
    setClocking(false);
    router.refresh();
  };

  const shiftLabel = (t: string) =>
    t === "day" ? "Day" : t === "evening" ? "Evening" : t === "night" ? "Night" : t;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-slate-200 dark:border-border">
        <CardContent className="pt-4">
          {message ? (
            <p className="mb-2 text-xs text-muted-foreground">{message}</p>
          ) : null}
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Time
              </p>
              <p className="text-sm font-medium mt-0.5">
                {isClockedIn
                  ? `In since ${format(new Date(latestTimeEntry!.clock_in_at), "h:mm a")}`
                  : "Not clocked in"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This week: {formatHours(weeklyClockedHours)}
              </p>
            </div>
            {isClockedIn ? (
              <Button
                variant="outline"
                size="sm"
                className="self-center"
                onClick={clockOut}
                disabled={clocking || timeTrackingUnavailable}
              >
                {clocking ? "Working..." : "Clock Out"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="self-center"
                onClick={clockIn}
                disabled={clocking || timeTrackingUnavailable}
              >
                {clocking ? "Working..." : "Clock In"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-border">
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Next Shift
          </p>
          <p className="text-sm font-medium mt-0.5">
            {nextShift
              ? `${shiftLabel(nextShift.shift_type)} · ${format(new Date(nextShift.scheduled_start), "EEE, MMM d")}`
              : "None scheduled"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-border">
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            LOA Status
          </p>
          <p className="text-sm font-medium mt-0.5">
            {loaStatus ? (
              <span
                className={
                  loaStatus === "approved"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : loaStatus === "denied"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400"
                }
              >
                {loaStatus.charAt(0).toUpperCase() + loaStatus.slice(1)}
                {loaDates ? ` · ${loaDates}` : ""}
              </span>
            ) : (
              "No pending requests"
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-border">
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Quick Actions
          </p>
          <Button variant="outline" size="sm" className="mt-2 gap-1.5" asChild>
            <Link href="/inbasket">
              <Inbox className="h-4 w-4" />
              In Basket
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
