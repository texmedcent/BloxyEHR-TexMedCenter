import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { formatOrderDetails, getMedicationName } from "@/lib/orders";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Medication List</CardTitle>
      </CardHeader>
      <CardContent>
        {medications.length === 0 ? (
          <p className="text-sm text-slate-500">No active medications</p>
        ) : (
          <ul className="space-y-2">
            {medications.map((med) => {
              const medName = getMedicationName(med.details);
              const display = medName || formatOrderDetails("med", med.details);
              return (
                <li key={med.id} className="rounded border border-slate-200 p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {display}
                      {med.is_controlled_substance && (
                        <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                          Controlled
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">{med.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Ordered {format(new Date(med.ordered_at), "MM/dd/yyyy HH:mm")}
                  </p>
                  {med.med_reconciled_at ? (
                    <p className="mt-1 text-xs text-emerald-700">
                      Med rec by {med.med_reconciled_by_name || "Clinician"} on{" "}
                      {format(new Date(med.med_reconciled_at), "MM/dd/yyyy HH:mm")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">Medication reconciliation pending</p>
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
