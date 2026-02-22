"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, UserSearch } from "lucide-react";
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
  pharmacy_verified_at: string | null;
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
  bypassPharmacyVerification?: boolean;
}

export function OrderView({
  patient,
  orders,
  resultByOrderId,
  emarLoggedOrderIds,
  claimedPatients,
  currentUserRole,
  selectedEncounterId,
  bypassPharmacyVerification = false,
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
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Order Entry</h1>
            <p className="text-sm text-slate-600 dark:text-muted-foreground">
              Place medication, lab, imaging, and procedure orders.
            </p>
          </div>
        </div>
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-6">
            {claimedPatients.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                  Quick Open
                </p>
                <div className="flex flex-wrap gap-2">
                  {claimedPatients.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      onClick={() => updateParams(p.id)}
                      className="gap-1.5"
                    >
                      <UserSearch className="h-3.5 w-3.5" />
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
      <div className="flex items-center gap-3">
        <ClipboardList className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">Order Entry</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="font-medium text-slate-800 dark:text-foreground">
              {patient.last_name}, {patient.first_name}
            </span>
            <span className="text-sm text-slate-500 dark:text-muted-foreground">
              MRN {patient.mrn}
            </span>
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              disabled={!canPlaceOrders}
              title={
                !canPlaceOrders
                  ? `${formatRoleLabel(currentUserRole)} cannot place new orders`
                  : undefined
              }
              className="bg-[#1a4d8c] hover:bg-[#1a4d8c]/90"
            >
              Place Order
            </Button>
          </div>
        </div>
      </div>
      {!canPlaceOrders && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {formatRoleLabel(currentUserRole)} cannot place new orders. You can still add results and eMAR logs.
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          Order action failed: {actionError}
        </div>
      )}

      <Card className="border-slate-200 dark:border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-8 text-center">
              <ClipboardList className="mx-auto h-12 w-12 text-slate-300 dark:text-muted-foreground mb-3" />
              <p className="text-sm text-slate-500 dark:text-muted-foreground mb-3">
                No orders yet.
              </p>
              <Button size="sm" onClick={() => setShowForm(true)} disabled={!canPlaceOrders}>
                Place first order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50">
                    <th className="text-left py-3 pr-4 pl-4 font-semibold text-slate-700 dark:text-foreground">Type</th>
                    <th className="text-left py-3 pr-4 font-semibold text-slate-700 dark:text-foreground">Status</th>
                    <th className="text-left py-3 pr-4 font-semibold text-slate-700 dark:text-foreground">Details</th>
                    <th className="text-left py-3 pr-4 font-semibold text-slate-700 dark:text-foreground">Ordered</th>
                    <th className="text-left py-3 pr-4 font-semibold text-slate-700 dark:text-foreground">Med Rec</th>
                    <th className="text-left py-3 pr-4 font-semibold text-slate-700 dark:text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const hasEmarLog = emarLoggedOrderIds.includes(o.id);
                    const needsPharmacyVerification =
                      o.type === "med" &&
                      (o.is_controlled_substance || o.high_risk_med) &&
                      !o.pharmacy_verified_at &&
                      !bypassPharmacyVerification;
                    const displayStatus =
                      o.type === "lab" || o.type === "imaging"
                        ? resultByOrderId[o.id]?.status || "pending"
                        : o.type === "med" && o.status === "pending" && hasEmarLog
                        ? "completed"
                        : o.status;
                    return (
                    <tr key={o.id} className="border-b border-slate-200 dark:border-border last:border-0 hover:bg-slate-50 dark:hover:bg-muted/30">
                      <td className="py-3 pr-4 pl-4 capitalize align-top">
                        {o.type}
                        {o.type === "med" && o.is_controlled_substance && (
                          <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                            Controlled
                          </span>
                        )}
                        {o.type === "med" && o.high_risk_med && (
                            <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                              High Risk
                            </span>
                          )}
                        {needsPharmacyVerification && (
                          <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                            Awaiting pharmacy verification
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 capitalize align-top">
                        <div className="flex flex-col gap-1">
                          <span>{displayStatus}</span>
                          {o.type === "imaging" && (
                            <span className="text-xs text-slate-500 dark:text-muted-foreground">{formatLifecycle(o.imaging_status)}</span>
                          )}
                          {o.type === "lab" && (
                            <span className="text-xs text-slate-500 dark:text-muted-foreground">{formatLifecycle(o.specimen_status)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        {formatOrderDetails(o.type, o.details)}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-muted-foreground align-top">
                        {format(new Date(o.ordered_at), "MM/dd/yyyy HH:mm")}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        {o.type !== "med" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-col gap-1 text-xs">
                            {o.med_reconciled_at ? (
                              <>
                                <span className="font-medium text-emerald-700">Reconciled</span>
                                <span className="text-slate-500 dark:text-muted-foreground">
                                  {o.med_reconciled_by_name || "Clinician"} ·{" "}
                                  {format(new Date(o.med_reconciled_at), "MM/dd HH:mm")}
                                </span>
                              </>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400">Pending</span>
                            )}
                            {o.next_due_at && (
                              <span className="text-slate-500 dark:text-muted-foreground">
                                Next due {format(new Date(o.next_due_at), "MM/dd HH:mm")}
                              </span>
                            )}
                            {o.next_due_at &&
                              new Date(o.next_due_at).getTime() < Date.now() &&
                              o.status !== "discontinued" && (
                                <span className="text-red-700 dark:text-red-400">Dose overdue</span>
                              )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          {(o.type === "lab" || o.type === "imaging") &&
                            (resultByOrderId[o.id]?.status === "final" ? (
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
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setSelectedOrderForResult(o)}
                              >
                                {resultByOrderId[o.id]
                                  ? "Update Result"
                                  : "Enter Result"}
                              </Button>
                            ))}
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
                              disabled={needsPharmacyVerification}
                              title={needsPharmacyVerification ? "This order requires pharmacist verification before administration. Have a pharmacist verify it in the Pharmacist Panel." : undefined}
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
            is_controlled_substance: selectedOrderForEmar.is_controlled_substance,
            high_risk_med: selectedOrderForEmar.high_risk_med,
            pharmacy_verified_at: selectedOrderForEmar.pharmacy_verified_at,
          }}
          bypassPharmacyVerification={bypassPharmacyVerification}
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
