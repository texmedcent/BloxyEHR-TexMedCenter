import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface HoursRow {
  user_id: string;
  full_name: string | null;
  total_hours: number;
}

interface AdminHoursSectionProps {
  hoursByPerson: HoursRow[];
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function AdminHoursSection({ hoursByPerson }: AdminHoursSectionProps) {
  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <Clock className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Hours Clocked
        </CardTitle>
        <CardDescription>Total hours clocked by each staff member (completed entries).</CardDescription>
      </CardHeader>
      <CardContent>
        {hoursByPerson.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-border">
                  <th className="text-left py-2 font-medium">Name</th>
                  <th className="text-right py-2 font-medium">Total Hours</th>
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
      </CardContent>
    </Card>
  );
}
