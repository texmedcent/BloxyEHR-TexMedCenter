import { createClient } from "@/lib/supabase/server";
import { DocumentationView } from "@/components/documentation/DocumentationView";

export default async function DocumentationPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; encounterId?: string }>;
}) {
  const { patientId, encounterId } = await searchParams;
  const supabase = await createClient();

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
  let notes: { id: string; type: string; content: string; signed_at: string | null; created_at: string }[] = [];
  let vitals: {
    id: string;
    type: string;
    value: string;
    unit: string | null;
    recorded_at: string;
  }[] = [];

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

      if (encounterId) {
        const { data: n } = await supabase
          .from("clinical_notes")
          .select("id, type, content, signed_at, created_at")
          .eq("encounter_id", encounterId)
          .order("created_at", { ascending: false });
        notes = n || [];
      }

      const { data: v } = await supabase
        .from("vital_signs")
        .select("id, type, value, unit, recorded_at")
        .eq("patient_id", patientId)
        .order("recorded_at", { ascending: false })
        .limit(20);
      vitals = v || [];
    }
  }

  return (
    <DocumentationView
      patient={patient}
      encounters={encounters}
      notes={notes}
      vitals={vitals}
      selectedEncounterId={encounterId}
    />
  );
}
