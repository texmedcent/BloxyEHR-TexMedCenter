import { createClient } from "@/lib/supabase/server";
import { OrderView } from "@/components/orders/OrderView";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; encounterId?: string }>;
}) {
  const { patientId, encounterId } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  let currentUserRole: string | null = null;

  let patient = null;
  let orders: {
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
  }[] = [];
  let bypassPharmacyVerification = false;
  const { data: instSettings } = await supabase
    .from("institution_settings")
    .select("bypass_pharmacy_verification")
    .eq("id", 1)
    .maybeSingle();
  bypassPharmacyVerification = instSettings?.bypass_pharmacy_verification ?? false;

  let resultByOrderId: Record<
    string,
    { id: string; status: string; value: unknown; reported_at: string }
  > = {};
  let emarLoggedOrderIds: string[] = [];
  let claimedPatients: {
    id: string;
    mrn: string;
    first_name: string;
    last_name: string;
  }[] = [];

  if (userId) {
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    currentUserRole = currentProfile?.role ?? null;

    const { data: claimedRows } = await supabase
      .from("recent_patients")
      .select("patient_id, viewed_at")
      .eq("user_id", userId)
      .eq("is_pinned", true)
      .order("viewed_at", { ascending: false })
      .limit(12);

    const ids = (claimedRows || []).map((r) => r.patient_id).filter(Boolean);
    if (ids.length > 0) {
      const { data: rows } = await supabase
        .from("patients")
        .select("id, mrn, first_name, last_name")
        .in("id", ids);
      claimedPatients = rows || [];
    }
  }

  if (patientId) {
    const { data: p } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name")
      .eq("id", patientId)
      .single();
    patient = p;

    if (patient) {
      let orderQuery = supabase
        .from("orders")
        .select(
          "id, type, status, ordered_at, details, patient_id, encounter_id, is_controlled_substance, med_reconciled_at, med_reconciled_by_name, high_risk_med, pharmacy_verified_at, next_due_at, administration_frequency, imaging_status, imaging_wet_read_text, imaging_final_impression, imaging_addendum_text, specimen_status, specimen_collected_at, specimen_collected_by_name, specimen_received_at, specimen_received_by_name, specimen_rejection_reason, recollect_requested"
        )
        .eq("patient_id", patientId)
        .order("ordered_at", { ascending: false })
        .limit(50);
      if (encounterId) {
        const { data: selectedEncounter } = await supabase
          .from("encounters")
          .select("id, admit_date, discharge_date")
          .eq("id", encounterId)
          .eq("patient_id", patientId)
          .maybeSingle();
        if (selectedEncounter?.admit_date) {
          const encounterStart = new Date(selectedEncounter.admit_date).toISOString();
          const encounterEnd = selectedEncounter.discharge_date
            ? new Date(selectedEncounter.discharge_date).toISOString()
            : new Date().toISOString();
          orderQuery = orderQuery.or(
            `encounter_id.eq.${encounterId},and(encounter_id.is.null,ordered_at.gte.${encounterStart},ordered_at.lte.${encounterEnd})`
          );
        } else {
          orderQuery = orderQuery.eq("encounter_id", encounterId);
        }
      }
      const { data: o } = await orderQuery;
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
      claimedPatients={claimedPatients}
      currentUserRole={currentUserRole}
      selectedEncounterId={encounterId || null}
      bypassPharmacyVerification={bypassPharmacyVerification}
    />
  );
}
