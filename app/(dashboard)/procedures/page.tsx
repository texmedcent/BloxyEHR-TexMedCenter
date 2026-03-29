import { getSessionAndUser } from "@/lib/supabase/server";
import { ProceduresView } from "@/components/procedures/ProceduresView";

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; encounterId?: string }>;
}) {
  const { patientId, encounterId } = await searchParams;
  const { supabase, userId } = await getSessionAndUser();

  let patient = null;
  let procedures: {
    id: string;
    type: string;
    status: string;
    ordered_at: string;
    details: unknown;
    patient_id: string;
    encounter_id: string | null;
  }[] = [];
  let narrativeByOrderId: Record<
    string,
    { id: string; status: string; value: unknown; reported_at: string }
  > = {};
  let claimedPatients: {
    id: string;
    mrn: string;
    first_name: string;
    last_name: string;
  }[] = [];

  if (userId) {
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
      let procedureQuery = supabase
        .from("orders")
        .select("id, type, status, ordered_at, details, patient_id, encounter_id")
        .eq("patient_id", patientId)
        .eq("type", "procedure")
        .order("ordered_at", { ascending: false })
        .limit(100);
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
          procedureQuery = procedureQuery.or(
            `encounter_id.eq.${encounterId},and(encounter_id.is.null,ordered_at.gte.${encounterStart},ordered_at.lte.${encounterEnd})`
          );
        } else {
          procedureQuery = procedureQuery.eq("encounter_id", encounterId);
        }
      }
      const { data: procedureRows } = await procedureQuery;
      procedures = procedureRows || [];

      const orderIds = procedures.map((r) => r.id);
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
        for (const resultRow of sorted) {
          if (!resultRow.order_id || map[resultRow.order_id]) continue;
          map[resultRow.order_id] = {
            id: resultRow.id,
            status: resultRow.status,
            value: resultRow.value,
            reported_at: resultRow.reported_at,
          };
        }
        narrativeByOrderId = map;
      }
    }
  }

  return (
    <ProceduresView
      patient={patient}
      procedures={procedures}
      narrativeByOrderId={narrativeByOrderId}
      claimedPatients={claimedPatients}
      selectedEncounterId={encounterId || null}
    />
  );
}
