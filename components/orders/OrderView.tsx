"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";

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
  encounter_id: string | null;
  is_controlled_substance: boolean;
  med_reconciled_at: string | null;
  med_reconciled_by_name: string | null;
  high_risk_med: boolean;
  next_due_at: string | null;
  administration_frequency: string | null;
  imaging_status: string;
  imaging_wet_read_text: string | null;
  imaging_final_impression: string | null;
  imaging_addendum_text: string | null;
  specimen_status: string;
  specimen_collected_at: string | null;
  specimen_collected_by_name: string | null;
  specimen_received_at: string | null;
  specimen_received_by_name: string | null;
  specimen_rejection_reason: string | null;
  recollect_requested: boolean;
}

interface OrderViewProps {
  patient: Patient | null;
  orders: Order[];
  resultByOrderId: Record<
    string,
    { id: string; status: string; value: unknown; reported_at: string }
  >;
  emarLoggedOrderIds: string[];
  claimedPatients: Patient[];
  currentUserRole: string | null;
  selectedEncounterId: string | null;
}

export function OrderView({
  patient,
  orders,
  resultByOrderId,
  emarLoggedOrderIds,
  claimedPatients,
  currentUserRole,
  selectedEncounterId,
}: OrderViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [selectedOrderForResult, setSelectedOrderForResult] = useState<Order | null>(null);
  const [selectedOrderForEmar, setSelectedOrderForEmar] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canPlaceOrders = hasRolePermission(currentUserRole, "place_order");

  const updateParams = (patientId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("patientId", patientId);
    params.delete("encounterId");
    router.push(`/orders?${params.toString()}`);
  };

  const discontinueOrder = async (order: Order) => {
    const reason = window.prompt("Discontinuation reason", "");
    if (reason === null) return;
    if (!reason.trim()) {
      setActionError("Discontinuation reason is required.");
      return;
    }
    setUpdatingOrderId(order.id);
    setActionError(null);
    const supabase = createClient();
    const detailsRecord =
      order.details && typeof order.details === "object" && !Array.isArray(order.details)
        ? (order.details as Record<string, unknown>)
        : {};
    const { error } = await supabase
      .from("orders")
      .update({
        status: "discontinued",
        details: {
          ...detailsRecord,
          discontinuation_reason: reason.trim(),
        },
      })
      .eq("id", order.id);
    setUpdatingOrderId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    router.refresh();
  };

  const reconcileMedication = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    setActionError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUpdatingOrderId(null);
      setActionError("You must be logged in.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { error } = await supabase
      .from("orders")
      .update({
        med_reconciled_at: new Date().toISOString(),
        med_reconciled_by: user.id,
        med_reconciled_by_name: profile?.full_name || user.email || "Clinician",
      })
      .eq("id", orderId)
      .eq("type", "med");

    setUpdatingOrderId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    router.refresh();
  };

  const updateOrderFields = async (
    orderId: string,
    updates: Record<string, unknown>,
    refresh = true
  ) => {
    setUpdatingOrderId(orderId);
    setActionError(null);
    const supabase = createClient();
    const { error } = await supabase.from("orders").update(updates).eq("id", orderId);
    setUpdatingOrderId(null);
    if (error) {
      setActionError(error.message);
      return false;
    }
    if (refresh) router.refresh();
    return true;
  };

  const formatLifecycle = (value: string) => value.replaceAll("_", " ");

  const getNextImagingStatus = (status: string) => {
    if (status === "ordered") return { status: "performed", label: "Mark Performed", atField: "imaging_performed_at" };
    if (status === "performed") return { status: "wet_read", label: "Mark Wet Read", atField: "imaging_wet_read_at" };
    if (status === "wet_read") return { status: "final_read", label: "Mark Final Read", atField: "imaging_final_read_at" };
    return null;
  };

  const getNextSpecimenStatus = (status: string) => {
    if (status === "pending_collection") return { status: "collected", label: "Mark Collected" };
    if (status === "collected") return { status: "received_by_lab", label: "Mark Received" };
    if (status === "received_by_lab") return { status: "completed", label: "Mark Complete" };
    return null;
  };

  const loadCurrentActor = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { userId: null as string | null, actorName: "Clinician" };
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    return {
      userId: user.id,
      actorName: profile?.full_name || user.email || "Clinician",
    };
  };

  const advanceImaging = async (order: Order) => {
    const next = getNextImagingStatus(order.imaging_status);
    if (!next) return;
    await updateOrderFields(order.id, {
      imaging_status: next.status,
      [next.atField]: new Date().toISOString(),
    });
  };

  const advanceSpecimen = async (order: Order) => {
    const next = getNextSpecimenStatus(order.specimen_status);
    if (!next) return;
    if (next.status === "collected" || next.status === "received_by_lab") {
      const actor = await loadCurrentActor();
      if (next.status === "collected") {
        await updateOrderFields(order.id, {
          specimen_status: "collected",
          specimen_collected_at: new Date().toISOString(),
          specimen_collected_by: actor.userId,
          specimen_collected_by_name: actor.actorName,
        });
        return;
      }
      await updateOrderFields(order.id, {
        specimen_status: "received_by_lab",
        specimen_received_at: new Date().toISOString(),
        specimen_received_by: actor.userId,
        specimen_received_by_name: actor.actorName,
      });
      return;
    }
    await updateOrderFields(order.id, { specimen_status: next.status });
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
            {claimedPatients.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Quick Order for Claimed Patients
                </p>
                <div className="flex flex-wrap gap-2">
                  {claimedPatients.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      onClick={() => updateParams(p.id)}
                    >
                      {p.last_name}, {p.first_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
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
        <Button
          onClick={() => setShowForm(true)}
          disabled={!canPlaceOrders}
          title={
            !canPlaceOrders
              ? `${formatRoleLabel(currentUserRole)} cannot place new orders`
              : undefined
          }
        >
          Place Order
        </Button>
      </div>
      {!canPlaceOrders && (
        <p className="text-sm text-amber-700">
          {formatRoleLabel(currentUserRole)} cannot place new medication, lab, imaging,
          or procedure orders. You can still add results and eMAR logs.
        </p>
      )}
      {actionError && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Order action failed: {actionError}
        </p>
      )}

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
                        {o.type === "med" && o.high_risk_med && (
                          <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                            High Risk
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 capitalize">
                        {displayStatus}
                        {o.type === "imaging" && (
                          <p className="text-[11px] text-slate-500">{formatLifecycle(o.imaging_status)}</p>
                        )}
                        {o.type === "lab" && (
                          <p className="text-[11px] text-slate-500">{formatLifecycle(o.specimen_status)}</p>
                        )}
                      </td>
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
                          {o.type === "med" && o.next_due_at && (
                          <p className="text-xs text-slate-500">
                            Next due {format(new Date(o.next_due_at), "MM/dd HH:mm")}
                          </p>
                        )}
                          {o.type === "med" &&
                            o.next_due_at &&
                            new Date(o.next_due_at).getTime() < Date.now() &&
                            o.status !== "discontinued" && (
                              <p className="text-xs text-red-700">Dose overdue</p>
                            )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {(o.type === "lab" || o.type === "imaging") && resultByOrderId[o.id] ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                router.push(
                                  `/results?patientId=${o.patient_id}${
                                    o.encounter_id ? `&encounterId=${o.encounter_id}` : ""
                                  }&type=${o.type}`
                                )
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
                          {o.type === "imaging" && (
                            <>
                              {getNextImagingStatus(o.imaging_status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={updatingOrderId === o.id}
                                  onClick={() => void advanceImaging(o)}
                                >
                                  {getNextImagingStatus(o.imaging_status)?.label}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={updatingOrderId === o.id}
                                onClick={() => {
                                  const addendum = window.prompt(
                                    "Imaging addendum",
                                    o.imaging_addendum_text || ""
                                  );
                                  if (addendum === null) return;
                                  void updateOrderFields(o.id, {
                                    imaging_addendum_text: addendum.trim() || null,
                                  });
                                }}
                              >
                                Add Addendum
                              </Button>
                            </>
                          )}
                          {o.type === "lab" && (
                            <>
                              {getNextSpecimenStatus(o.specimen_status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={updatingOrderId === o.id}
                                  onClick={() => void advanceSpecimen(o)}
                                >
                                  {getNextSpecimenStatus(o.specimen_status)?.label}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={updatingOrderId === o.id}
                                onClick={() => {
                                  const reason = window.prompt(
                                    "Rejection reason",
                                    o.specimen_rejection_reason || ""
                                  );
                                  if (reason === null) return;
                                  void updateOrderFields(o.id, {
                                    specimen_status: "rejected",
                                    specimen_rejection_reason: reason.trim() || null,
                                    recollect_requested: true,
                                  });
                                }}
                              >
                                Reject/Recollect
                              </Button>
                            </>
                          )}
                          {o.type === "med" && o.status !== "discontinued" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => discontinueOrder(o)}
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
          currentUserRole={currentUserRole}
          selectedEncounterId={selectedEncounterId}
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
          order={{
            id: selectedOrderForEmar.id,
            patient_id: selectedOrderForEmar.patient_id,
            details: selectedOrderForEmar.details,
            next_due_at: selectedOrderForEmar.next_due_at,
            administration_frequency: selectedOrderForEmar.administration_frequency,
          }}
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
