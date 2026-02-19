import { createClient } from "@/lib/supabase/server";
import { DocumentationView } from "@/components/documentation/DocumentationView";

export default async function DocumentationPage({
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
  let encounters: {
    id: string;
    type: string;
    admit_date: string | null;
    status: string;
    differential_diagnosis: string | null;
    final_diagnosis_code: string | null;
    final_diagnosis_description: string | null;
    final_treatment_plan: string | null;
  }[] = [];
  let notes: {
    id: string;
    type: string;
    content: string;
    signed_at: string | null;
    created_at: string;
    encounter_id: string;
    requires_cosign?: boolean;
    cosign_status?: string;
    cosigned_by_name?: string | null;
    cosigned_at?: string | null;
    is_addendum?: boolean;
    parent_note_id?: string | null;
    addendum_reason?: string | null;
    released_to_patient?: boolean;
    patient_release_hold?: boolean;
    patient_release_hold_reason?: string | null;
  }[] = [];
  let vitals: {
    id: string;
    type: string;
    value: string;
    unit: string | null;
    recorded_at: string;
  }[] = [];
  let claimedPatients: { id: string; mrn: string; first_name: string; last_name: string }[] = [];

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
      const { data: enc } = await supabase
        .from("encounters")
        .select(
          "id, type, admit_date, status, differential_diagnosis, final_diagnosis_code, final_diagnosis_description, final_treatment_plan"
        )
        .eq("patient_id", patientId)
        .order("admit_date", { ascending: false });
      encounters = enc || [];

      const encounterIds = (encounters || []).map((encounter) => encounter.id);
      const activeEncounter =
        (encounters || []).find((encounter) => encounter.status === "active") || null;
      if (encounterId) {
        const { data: n } = await supabase
          .from("clinical_notes")
          .select("id, type, content, signed_at, created_at, encounter_id, requires_cosign, cosign_status, cosigned_by_name, cosigned_at, is_addendum, parent_note_id, addendum_reason, released_to_patient, patient_release_hold, patient_release_hold_reason")
          .eq("encounter_id", encounterId)
          .order("created_at", { ascending: false });
        notes = n || [];
      } else if (encounterIds.length > 0) {
        const { data: n } = await supabase
          .from("clinical_notes")
          .select("id, type, content, signed_at, created_at, encounter_id, requires_cosign, cosign_status, cosigned_by_name, cosigned_at, is_addendum, parent_note_id, addendum_reason, released_to_patient, patient_release_hold, patient_release_hold_reason")
          .in("encounter_id", encounterIds)
          .order("created_at", { ascending: false })
          .limit(100);
        notes = n || [];
      }

      if (activeEncounter?.id) {
        const { data: v } = await supabase
          .from("vital_signs")
          .select("id, type, value, unit, recorded_at, encounter_id")
          .eq("patient_id", patientId)
          .eq("encounter_id", activeEncounter.id)
          .order("recorded_at", { ascending: false })
          .limit(20);
        vitals = v || [];
      } else {
        vitals = [];
      }
    }
  }

  return (
    <DocumentationView
      patient={patient}
      encounters={encounters}
      notes={notes}
      vitals={vitals}
      claimedPatients={claimedPatients}
      selectedEncounterId={encounterId}
      currentUserRole={currentUserRole}
    />
  );
}
