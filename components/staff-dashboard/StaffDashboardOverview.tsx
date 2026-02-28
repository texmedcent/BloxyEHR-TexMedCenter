"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Briefcase, Inbox } from "lucide-react";
import { format } from "date-fns";

interface StaffDashboardOverviewProps {
  currentUserId: string;
  latestTimeEntry: { id: string; clock_in_at: string; clock_out_at: string | null } | null;
  nextShift: { shift_type: string; scheduled_start: string; scheduled_end: string } | null;
  loaStatus: "pending" | "approved" | "denied" | null;
  loaDates?: string;
}

export function StaffDashboardOverview({
  currentUserId,
  latestTimeEntry,
  nextShift,
  loaStatus,
  loaDates,
}: StaffDashboardOverviewProps) {
  const router = useRouter();
  const isClockedIn = latestTimeEntry && !latestTimeEntry.clock_out_at;

  const clockIn = async () => {
    const supabase = createClient();
    await supabase.from("staff_time_entries").insert({
      user_id: currentUserId,
      clock_in_at: new Date().toISOString(),
    });
    router.refresh();
  };

  const clockOut = async () => {
    if (!latestTimeEntry?.id) return;
    const supabase = createClient();
    await supabase
      .from("staff_time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", latestTimeEntry.id);
    router.refresh();
  };

  const shiftLabel = (t: string) =>
    t === "day" ? "Day" : t === "evening" ? "Evening" : t === "night" ? "Night" : t;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="border-slate-200 dark:border-border">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Time
              </p>
              <p className="text-sm font-medium mt-0.5">
                {isClockedIn
                  ? `In since ${format(new Date(latestTimeEntry!.clock_in_at), "h:mm a")}`
                  : "Not clocked in"}
              </p>
            </div>
            {isClockedIn ? (
              <Button variant="outline" size="sm" onClick={clockOut}>
                Clock Out
              </Button>
            ) : (
              <Button size="sm" onClick={clockIn}>
                Clock In
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
