import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { formatOrderDetails, getMedicationName } from "@/lib/orders";
import { Pill } from "lucide-react";

interface MedicationOrder {
  id: string;
  status: string;
  ordered_at: string;
  details: unknown;
  is_controlled_substance?: boolean;
  med_reconciled_at?: string | null;
  med_reconciled_by_name?: string | null;
}

export function MedicationListPanel({ medications }: { medications: MedicationOrder[] }) {
  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          Medication List
        </CardTitle>
      </CardHeader>
      <CardContent>
        {medications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
            <Pill className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
            <p className="text-sm text-slate-500 dark:text-muted-foreground">
              No active medications
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {medications.map((med) => {
              const medName = getMedicationName(med.details);
              const display = medName || formatOrderDetails("med", med.details);
              return (
                <li
                  key={med.id}
                  className="rounded-lg border border-slate-200 dark:border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-foreground">
                      {display}
                      {med.is_controlled_substance && (
                        <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                          Controlled
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-xs capitalize rounded-full px-2 py-0.5 ${
                        med.status === "pending"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                          : "bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground"
                      }`}
                    >
                      {med.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                    Ordered {format(new Date(med.ordered_at), "MM/dd/yyyy HH:mm")}
                  </p>
                  {med.med_reconciled_at ? (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                      Med rec by {med.med_reconciled_by_name || "Clinician"} on{" "}
                      {format(new Date(med.med_reconciled_at), "MM/dd/yyyy HH:mm")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Medication reconciliation pending
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
