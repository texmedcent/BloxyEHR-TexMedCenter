import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSessionAndUser } from "@/lib/supabase/server";
import { isHospitalManager } from "@/lib/roles";
import { Clock } from "lucide-react";

interface HoursRow {
  user_id: string;
  full_name: string | null;
  total_hours: number;
}

interface AdminHoursSectionProps {
  hoursByPerson: HoursRow[];
  weekStartIso: string;
  timeEntriesForCorrection: {
    id: string;
    user_id: string;
    full_name: string | null;
    clock_in_at: string;
    clock_out_at: string | null;
    created_at: string;
  }[];
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AdminHoursSection({ hoursByPerson, weekStartIso, timeEntriesForCorrection }: AdminHoursSectionProps) {
  async function updateTimeEntry(formData: FormData) {
    "use server";

    const entryId = String(formData.get("entry_id") || "");
    const clockInRaw = String(formData.get("clock_in_at") || "").trim();
    const clockOutRaw = String(formData.get("clock_out_at") || "").trim();

    if (!entryId || !clockInRaw) return;

    const clockIn = new Date(clockInRaw);
    if (Number.isNaN(clockIn.getTime())) return;

    const clockOut = clockOutRaw ? new Date(clockOutRaw) : null;
    if (clockOutRaw && (!clockOut || Number.isNaN(clockOut.getTime()))) return;
    if (clockOut && clockOut <= clockIn) return;

    const { supabase, userId } = await getSessionAndUser();
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (!isHospitalManager(profile?.role)) return;

    await supabase
      .from("staff_time_entries")
      .update({
        clock_in_at: clockIn.toISOString(),
        clock_out_at: clockOut ? clockOut.toISOString() : null,
      })
      .eq("id", entryId);

    revalidatePath("/admin");
    revalidatePath("/staff-dashboard");
  }

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <Clock className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Weekly Hours Clocked
        </CardTitle>
        <CardDescription>
          Hours clocked this week (resets every Monday at 12:00 AM server time).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Week starts: {new Date(weekStartIso).toLocaleString()}
        </p>
        {hoursByPerson.length === 0 ? <p className="text-sm text-muted-foreground">No time entries yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-border">
                  <th className="text-left py-2 font-medium">Name</th>
                  <th className="text-right py-2 font-medium">Weekly Hours</th>
                </tr>
              </thead>
              <tbody>
                {hoursByPerson.map((r) => (
                  <tr key={r.user_id} className="border-b border-slate-100 dark:border-border/50">
                    <td className="py-2">{r.full_name ?? "Unknown"}</td>
                    <td className="text-right py-2">{formatHours(r.total_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-border">
          <h4 className="text-sm font-medium">Manager Corrections</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Edit recent clock-in/clock-out times to fix missed clock-outs or incorrect times.
          </p>
          {timeEntriesForCorrection.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No recent entries found.</p>
          ) : (
            <div className="mt-3 max-h-80 overflow-y-auto rounded-md border border-slate-200 dark:border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-slate-200 dark:border-border">
                    <th className="px-2 py-2 text-left font-medium">Staff</th>
                    <th className="px-2 py-2 text-left font-medium">Edit Times</th>
                    <th className="px-2 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntriesForCorrection.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 align-top dark:border-border/50">
                      <td className="px-2 py-2">{entry.full_name ?? "Unknown"}</td>
                      <td className="px-2 py-2">
                        <form action={updateTimeEntry} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input type="hidden" name="entry_id" value={entry.id} />
                          <Input
                            type="datetime-local"
                            name="clock_in_at"
                            defaultValue={toLocalDateTimeInput(entry.clock_in_at)}
                            required
                          />
                          <Input
                            type="datetime-local"
                            name="clock_out_at"
                            defaultValue={toLocalDateTimeInput(entry.clock_out_at)}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Save
                          </Button>
                        </form>
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                        {entry.clock_out_at ? "Closed" : "Open"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
