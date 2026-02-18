import { createClient } from "@/lib/supabase/server";
import { OrderView } from "@/components/orders/OrderView";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const { patientId } = await searchParams;
  const supabase = await createClient();

  let patient = null;
  let orders: {
    id: string;
    type: string;
    status: string;
    ordered_at: string;
    details: unknown;
    patient_id: string;
    is_controlled_substance: boolean;
    med_reconciled_at: string | null;
    med_reconciled_by_name: string | null;
  }[] = [];
  let resultByOrderId: Record<
    string,
    { id: string; status: string; value: unknown; reported_at: string }
  > = {};
  let emarLoggedOrderIds: string[] = [];

  if (patientId) {
    const { data: p } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name")
      .eq("id", patientId)
      .single();
    patient = p;

    if (patient) {
      const { data: o } = await supabase
        .from("orders")
        .select(
          "id, type, status, ordered_at, details, patient_id, is_controlled_substance, med_reconciled_at, med_reconciled_by_name"
        )
        .eq("patient_id", patientId)
        .order("ordered_at", { ascending: false })
        .limit(50);
      orders = o || [];

      const orderIds = (orders || []).map((r) => r.id);
      if (orderIds.length > 0) {
        const { data: existingResults } = await supabase
          .from("results")
          .select("id, order_id, status, value, reported_at")
          .in("order_id", orderIds);
        const sorted = (existingResults || []).sort(
          (a, b) =>
            new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
        );
        const map: Record<
          string,
          { id: string; status: string; value: unknown; reported_at: string }
        > = {};
        for (const r of sorted) {
          if (!r.order_id || map[r.order_id]) continue;
          map[r.order_id] = {
            id: r.id,
            status: r.status,
            value: r.value,
            reported_at: r.reported_at,
          };
        }
        resultByOrderId = map;

        const { data: emarRows } = await supabase
          .from("med_admin_log")
          .select("order_id")
          .in("order_id", orderIds);
        emarLoggedOrderIds = Array.from(
          new Set(
            (emarRows || [])
              .map((r) => r.order_id)
              .filter((x): x is string => Boolean(x))
          )
        );
      }
    }
  }

  return (
    <OrderView
      patient={patient}
      orders={orders}
      resultByOrderId={resultByOrderId}
      emarLoggedOrderIds={emarLoggedOrderIds}
    />
  );
}
