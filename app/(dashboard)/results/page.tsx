import { createClient } from "@/lib/supabase/server";
import { ResultsView } from "@/components/results/ResultsView";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; type?: string; encounterId?: string }>;
}) {
  const { patientId, type, encounterId } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  let currentUserRole: string | null = null;

  let patient = null;
  let results: {
    id: string;
    type: string;
    value: unknown;
    reported_at: string;
    status: string;
    order_id: string | null;
  }[] = [];
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
      let encounterOrderIds: string[] | null = null;
      if (encounterId) {
        const { data: selectedEncounter } = await supabase
          .from("encounters")
          .select("id, admit_date, discharge_date")
          .eq("id", encounterId)
          .eq("patient_id", patientId)
          .maybeSingle();
        let encounterOrdersQuery = supabase
          .from("orders")
          .select("id")
          .eq("patient_id", patientId);
        if (selectedEncounter?.admit_date) {
          const encounterStart = new Date(selectedEncounter.admit_date).toISOString();
          const encounterEnd = selectedEncounter.discharge_date
            ? new Date(selectedEncounter.discharge_date).toISOString()
            : new Date().toISOString();
          encounterOrdersQuery = encounterOrdersQuery.or(
            `encounter_id.eq.${encounterId},and(encounter_id.is.null,ordered_at.gte.${encounterStart},ordered_at.lte.${encounterEnd})`
          );
        } else {
          encounterOrdersQuery = encounterOrdersQuery.eq("encounter_id", encounterId);
        }
        const { data: encounterOrders } = await encounterOrdersQuery;
        encounterOrderIds = (encounterOrders || []).map((row) => row.id);
      }

      let query = supabase
        .from("results")
        .select("id, type, value, reported_at, status, order_id, acknowledgment_status, acknowledged_by_name, acknowledged_at, actioned_by_name, actioned_at, is_critical, critical_reason, reviewed_note, action_note, critical_callback_documented, critical_callback_documented_at, critical_callback_documented_by_name, reviewed_latency_minutes, action_latency_minutes, escalation_triggered_at, escalation_recipient_name, sla_violation_reviewed, sla_violation_actioned, released_to_patient, patient_release_hold, patient_release_hold_reason")
        .eq("patient_id", patientId)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (type) {
        query = query.eq("type", type);
      }
      if (encounterId) {
        if ((encounterOrderIds || []).length === 0) {
          results = [];
        } else {
          query = query.in("order_id", encounterOrderIds || []);
        }
      }
      const { data: r } = await query;
      if (!encounterId || (encounterOrderIds || []).length > 0) {
        results = r || [];
      }
    }
  }

  return (
    <ResultsView
      patient={patient}
      results={results}
      filterType={type}
      claimedPatients={claimedPatients}
      selectedEncounterId={encounterId || null}
      currentUserRole={currentUserRole}
    />
  );
}
