import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isAbnormalVital } from "@/lib/vitals";
import { Activity, AlertTriangle } from "lucide-react";

interface VitalSign {
  id: string;
  type: string;
  value: string;
  unit: string | null;
  recorded_at: string;
}

interface VitalsPanelProps {
  patientId: string;
  vitals: VitalSign[];
}

export function VitalsPanel({ vitals }: VitalsPanelProps) {
  return (
    <Card className="border-slate-200 dark:border-border" id="vitals">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-normal flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          Vital Signs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vitals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
            <Activity className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
            <p className="text-sm text-slate-500 dark:text-muted-foreground">
              No vital signs recorded yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50">
                  <th className="text-left py-2.5 pr-4 pl-3 font-semibold text-slate-700 dark:text-foreground">
                    Type
                  </th>
                  <th className="text-left py-2.5 pr-4 font-semibold text-slate-700 dark:text-foreground">
                    Value
                  </th>
                  <th className="text-left py-2.5 pr-3 font-semibold text-slate-700 dark:text-foreground">
                    Date/Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => {
                  const abnormal = isAbnormalVital(v.type, v.value, v.unit);
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-slate-200 dark:border-border last:border-0 hover:bg-slate-50 dark:hover:bg-muted/30"
                    >
                      <td className="py-2.5 pr-4 pl-3 capitalize">
                        {v.type.replaceAll("_", " ")}
                        {abnormal && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Abnormal
                          </span>
                        )}
                      </td>
                      <td className={cn("py-2.5 pr-4", abnormal && "font-semibold text-red-600 dark:text-red-400")}>
                        {v.value}
                        {v.unit && (
                          <span className="text-slate-500 dark:text-muted-foreground">
                            {" "}
                            {v.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 dark:text-muted-foreground">
                        {format(new Date(v.recorded_at), "MM/dd/yyyy HH:mm")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
