"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { OrderForm } from "./OrderForm";
import { OrderResultForm } from "./OrderResultForm";
import { MedicationAdminLogModal } from "./MedicationAdminLogModal";
import { PatientSearchSelect } from "@/components/documentation/PatientSearchSelect";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatOrderDetails } from "@/lib/orders";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface Order {
  id: string;
  type: string;
  status: string;
  ordered_at: string;
  details: unknown;
  patient_id: string;
  is_controlled_substance: boolean;
  med_reconciled_at: string | null;
  med_reconciled_by_name: string | null;
}

interface OrderViewProps {
  patient: Patient | null;
  orders: Order[];
  resultByOrderId: Record<
    string,
    { id: string; status: string; value: unknown; reported_at: string }
  >;
  emarLoggedOrderIds: string[];
}

export function OrderView({
  patient,
  orders,
  resultByOrderId,
  emarLoggedOrderIds,
}: OrderViewProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedOrderForResult, setSelectedOrderForResult] = useState<Order | null>(null);
  const [selectedOrderForEmar, setSelectedOrderForEmar] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const updateParams = (patientId: string) => {
    router.push(`/orders?patientId=${patientId}`);
  };

  const discontinueOrder = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    const supabase = createClient();
    await supabase
      .from("orders")
      .update({ status: "discontinued" })
      .eq("id", orderId);
    setUpdatingOrderId(null);
    router.refresh();
  };

  const reconcileMedication = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUpdatingOrderId(null);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    await supabase
      .from("orders")
      .update({
        med_reconciled_at: new Date().toISOString(),
        med_reconciled_by: user.id,
        med_reconciled_by_name: profile?.full_name || user.email || "Clinician",
      })
      .eq("id", orderId)
      .eq("type", "med");

    setUpdatingOrderId(null);
    router.refresh();
  };

  if (!patient) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Order Entry</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">
              Search for a patient to place orders.
            </p>
            <PatientSearchSelect onSelect={updateParams} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Order Entry</h1>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-medium">
          {patient.last_name}, {patient.first_name}
        </span>
        <span className="text-sm text-gray-500">MRN: {patient.mrn}</span>
        <Button onClick={() => setShowForm(true)}>Place Order</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Details</th>
                    <th className="text-left py-2 pr-4">Ordered</th>
                    <th className="text-left py-2 pr-4">Med Rec</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const hasEmarLog = emarLoggedOrderIds.includes(o.id);
                    const displayStatus =
                      o.type === "lab" || o.type === "imaging"
                        ? resultByOrderId[o.id]?.status || "pending"
                        : o.type === "med" && o.status === "pending" && hasEmarLog
                        ? "completed"
                        : o.status;
                    return (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 capitalize">
                        {o.type}
                        {o.type === "med" && o.is_controlled_substance && (
                          <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                            Controlled
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 capitalize">{displayStatus}</td>
                      <td className="py-2 pr-4">
                        {formatOrderDetails(o.type, o.details)}
                      </td>
                      <td className="py-2 text-gray-500">
                        {format(new Date(o.ordered_at), "MM/dd/yyyy HH:mm")}
                      </td>
                      <td className="py-2 pr-4">
                        {o.type !== "med" ? (
                          <span className="text-slate-400">—</span>
                        ) : o.med_reconciled_at ? (
                          <div className="text-xs">
                            <p className="font-medium text-emerald-700">Reconciled</p>
                            <p className="text-slate-500">
                              {o.med_reconciled_by_name || "Clinician"} ·{" "}
                              {format(new Date(o.med_reconciled_at), "MM/dd HH:mm")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {(o.type === "lab" || o.type === "imaging") && resultByOrderId[o.id] ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                router.push(`/results?patientId=${o.patient_id}&type=${o.type}`)
                              }
                            >
                              View Result
                            </Button>
                          ) : o.type === "lab" || o.type === "imaging" ? (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setSelectedOrderForResult(o)}
                            >
                              Enter Preliminary
                            </Button>
                          ) : null}
                          {(o.type === "lab" || o.type === "imaging") &&
                            resultByOrderId[o.id]?.status !== "final" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setSelectedOrderForResult(o)}
                              >
                                {resultByOrderId[o.id]
                                  ? "Update / Finalize"
                                  : "Enter Result"}
                              </Button>
                            )}
                          {o.type === "med" && o.status !== "discontinued" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => reconcileMedication(o.id)}
                              disabled={updatingOrderId === o.id}
                            >
                              {updatingOrderId === o.id ? "Updating..." : "Med Rec"}
                            </Button>
                          )}
                          {o.type === "med" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => setSelectedOrderForEmar(o)}
                            >
                              eMAR Log
                            </Button>
                          )}
                          {o.type === "med" && o.status !== "discontinued" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => discontinueOrder(o.id)}
                              disabled={updatingOrderId === o.id}
                            >
                              {updatingOrderId === o.id ? "Updating..." : "Discontinue"}
                            </Button>
                          )}
                          {o.type !== "lab" &&
                            o.type !== "imaging" &&
                            o.type !== "med" && (
                              <span className="text-xs text-slate-500">
                                Use Documentation for narrative notes
                              </span>
                            )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <OrderForm
          patientId={patient.id}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}

      {selectedOrderForResult && (
        <OrderResultForm
          order={selectedOrderForResult}
          existingResult={resultByOrderId[selectedOrderForResult.id]}
          mode="result"
          onClose={() => setSelectedOrderForResult(null)}
          onSaved={() => {
            setSelectedOrderForResult(null);
            router.refresh();
          }}
        />
      )}
      {selectedOrderForEmar && (
        <MedicationAdminLogModal
          order={selectedOrderForEmar}
          onLogged={() => router.refresh()}
          onClose={() => {
            setSelectedOrderForEmar(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
