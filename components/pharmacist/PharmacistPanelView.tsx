"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Pill, CheckCircle2, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatOrderDetails, getMedicationName } from "@/lib/orders";
import { format } from "date-fns";

const POLL_MS = 45000;

interface OrderRow {
  id: string;
  details: unknown;
  ordered_at: string;
  ordered_by: string | null;
  patient_id: string;
  is_controlled_substance: boolean;
  high_risk_med: boolean;
  ordered_by_name: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_mrn: string;
}

interface PharmacistPanelViewProps {
  initialOrders: OrderRow[];
  bypassOn: boolean;
  currentUserId?: string;
}

export function PharmacistPanelView({
  initialOrders,
  bypassOn,
}: PharmacistPanelViewProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapToOrderRows = useCallback(
    (rows: { id: string; details: unknown; ordered_at: string; ordered_by: string | null; patient_id: string; is_controlled_substance: boolean; high_risk_med: boolean; ordered_by_name?: string; patient_first_name?: string; patient_last_name?: string; patient_mrn?: string }[]): OrderRow[] =>
      (rows || []).map((r) => ({
        id: r.id,
        details: r.details,
        ordered_at: r.ordered_at,
        ordered_by: r.ordered_by,
        patient_id: r.patient_id,
        is_controlled_substance: r.is_controlled_substance,
        high_risk_med: r.high_risk_med,
        ordered_by_name: r.ordered_by_name ?? "Staff",
        patient_first_name: r.patient_first_name ?? "",
        patient_last_name: r.patient_last_name ?? "",
        patient_mrn: r.patient_mrn ?? "",
      })),
    []
  );

  const fetchOrders = useCallback(async () => {
    if (bypassOn) return;
    const supabase = createClient();
    const { data: rows, error } = await supabase.rpc("fetch_pending_pharmacy_verification_orders");
    if (!error) {
      setError(null);
      setOrders(mapToOrderRows(rows || []));
      return;
    }
    if (error.message?.includes("schema cache") || error.message?.includes("Could not find the function")) {
      const { data: orderRows } = await supabase
        .from("orders")
        .select("id, details, ordered_at, ordered_by, patient_id, is_controlled_substance, high_risk_med")
        .eq("type", "med")
        .or("is_controlled_substance.eq.true,high_risk_med.eq.true")
        .in("status", ["pending", "active", "held"])
        .is("pharmacy_verified_at", null)
        .order("ordered_at", { ascending: true })
        .limit(50);
      const list = orderRows || [];
      const patientIds = [...new Set(list.map((o) => o.patient_id).filter(Boolean))];
      const patientMap = new Map<string, { first_name: string; last_name: string; mrn: string }>();
      if (patientIds.length > 0) {
        const { data: patients } = await supabase.from("patients").select("id, first_name, last_name, mrn").in("id", patientIds);
        for (const p of patients ?? []) {
          patientMap.set(p.id, { first_name: p.first_name, last_name: p.last_name, mrn: p.mrn });
        }
      }
      const orderRowsWithNames = list.map((o) => ({
        ...o,
        ordered_by_name: "Staff",
        patient_first_name: patientMap.get(o.patient_id)?.first_name ?? "",
        patient_last_name: patientMap.get(o.patient_id)?.last_name ?? "",
        patient_mrn: patientMap.get(o.patient_id)?.mrn ?? "",
      }));
      setError(null);
      setOrders(mapToOrderRows(orderRowsWithNames));
      return;
    }
    setError(`Unable to load orders: ${error.message}`);
  }, [bypassOn, mapToOrderRows]);

  useEffect(() => {
    void fetchOrders();
    const interval = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleVerify = async (orderId: string) => {
    setVerifyingId(orderId);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: rpcError } = await supabase.rpc("verify_pharmacy_order", {
      p_order_id: orderId,
    });

    if (!rpcError) {
      setVerifyingId(null);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      return;
    }
    if (rpcError.message?.includes("schema cache") || rpcError.message?.includes("Could not find the function")) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          pharmacy_verified_at: new Date().toISOString(),
          pharmacy_verified_by: user?.id ?? null,
        })
        .eq("id", orderId);
      setVerifyingId(null);
      if (!updateError) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
        return;
      }
      setError(`Failed to verify: ${updateError.message}`);
      return;
    }
    setVerifyingId(null);
    setError(`Failed to verify: ${rpcError.message}`);
  };

  const retryFetch = () => {
    setError(null);
    void fetchOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Pill className="h-6 w-6 text-[#1a4d8c] dark:text-primary shrink-0" />
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground">
          Pharmacist Panel
        </h1>
      </div>
      <p className="text-sm text-slate-600 dark:text-muted-foreground">
        Verify controlled substances and high-risk medications before nurses can
        document administration.
      </p>

      {bypassOn ? (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 dark:text-foreground">
                  No pharmacist on duty
                </p>
                <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                  Verification is bypassed. Controlled and high-risk medication
                  orders can be administered without pharmacist approval. Toggle
                  this in Institution Settings when a pharmacist returns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={retryFetch}>
                Retry
              </Button>
            </div>
          )}

          {orders.length === 0 ? (
            <Card className="border-slate-200 dark:border-border">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500 mb-3" />
                  <p className="font-medium text-slate-900 dark:text-foreground">
                    No orders pending verification
                  </p>
                  <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                    All controlled and high-risk medication orders have been
                    verified.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">
                Pending verification ({orders.length})
              </h2>
              <div className="grid gap-3">
                {orders.map((order) => {
                  const patientParts = [order.patient_last_name, order.patient_first_name].filter(Boolean);
                  const patientName = patientParts.length > 0 ? patientParts.join(", ") : "Unknown patient";
                  const mrn = order.patient_mrn ?? "";
                  const orderedByName = order.ordered_by_name || "—";

                  return (
                    <Card
                      key={order.id}
                      className="border-slate-200 dark:border-border"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">
                            {getMedicationName(order.details) ||
                              formatOrderDetails("med", order.details)}
                          </CardTitle>
                          {order.is_controlled_substance && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                              <Shield className="h-3 w-3" />
                              Controlled
                            </span>
                          )}
                          {order.high_risk_med && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-800 dark:text-red-200">
                              <AlertTriangle className="h-3 w-3" />
                              High-risk
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-slate-600 dark:text-muted-foreground">
                          {formatOrderDetails("med", order.details)}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-muted-foreground">
                          <span>
                            <strong className="text-slate-700 dark:text-foreground">
                              Patient:
                            </strong>{" "}
                            <Link
                              href={`/chart/${order.patient_id}`}
                              className="text-[#1a4d8c] dark:text-primary font-medium hover:underline"
                            >
                              {patientName}
                              {mrn && ` (${mrn})`}
                            </Link>
                          </span>
                          <span>
                            <strong className="text-slate-700 dark:text-foreground">
                              Ordered:
                            </strong>{" "}
                            {format(
                              new Date(order.ordered_at),
                              "MMM d, yyyy h:mm a"
                            )}{" "}
                            by {orderedByName}
                          </span>
                        </div>
                        <div className="pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleVerify(order.id)}
                            disabled={verifyingId === order.id}
                          >
                            {verifyingId === order.id ? (
                              "Verifying..."
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Verify
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
