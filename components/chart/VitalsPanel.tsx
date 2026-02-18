import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isAbnormalVital } from "@/lib/vitals";
import { AlertTriangle } from "lucide-react";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-normal">Vital Signs</CardTitle>
      </CardHeader>
      <CardContent>
        {vitals.length === 0 ? (
          <p className="text-sm text-slate-500">No vital signs recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-2 pr-4 font-semibold text-slate-600">Type</th>
                  <th className="text-left py-2 pr-4 font-semibold text-slate-600">Value</th>
                  <th className="text-left py-2 font-semibold text-slate-600">Date/Time</th>
                </tr>
              </thead>
              <tbody>
                {vitals.map((v) => {
                  const abnormal = isAbnormalVital(v.type, v.value, v.unit);
                  return (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 capitalize">
                        {v.type.replaceAll("_", " ")}
                        {abnormal && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            Abnormal
                          </span>
                        )}
                      </td>
                      <td className={cn("py-2 pr-4", abnormal && "font-semibold text-red-600")}>
                        {v.value}
                        {v.unit && <span className="text-slate-500"> {v.unit}</span>}
                      </td>
                      <td className="py-2 text-slate-500">
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
