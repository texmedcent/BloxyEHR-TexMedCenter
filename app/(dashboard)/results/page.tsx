import { createClient } from "@/lib/supabase/server";
import { ResultsView } from "@/components/results/ResultsView";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; type?: string }>;
}) {
  const { patientId, type } = await searchParams;
  const supabase = await createClient();

  let patient = null;
  let results: {
    id: string;
    type: string;
    value: unknown;
    reported_at: string;
    status: string;
    order_id: string | null;
  }[] = [];

  if (patientId) {
    const { data: p } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name")
      .eq("id", patientId)
      .single();
    patient = p;

    if (patient) {
      let query = supabase
        .from("results")
        .select("id, type, value, reported_at, status, order_id")
        .eq("patient_id", patientId)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (type) {
        query = query.eq("type", type);
      }
      const { data: r } = await query;
      results = r || [];
    }
  }

  return <ResultsView patient={patient} results={results} filterType={type} />;
}
