import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { PatientSummaryBar } from "@/components/chart/PatientSummaryBar";
import { PatientDemographics } from "@/components/chart/PatientDemographics";
import { VitalsPanel } from "@/components/chart/VitalsPanel";
import { AllergiesPanel } from "@/components/chart/AllergiesPanel";
import { ProblemList } from "@/components/chart/ProblemList";
import { EncounterHistory } from "@/components/chart/EncounterHistory";
import { RecordRecentPatient } from "@/components/chart/RecordRecentPatient";
import { EditDemographicsButton } from "@/components/chart/EditDemographicsButton";
import { MedicationListPanel } from "@/components/chart/MedicationListPanel";
import Link from "next/link";
import { ClipboardList, FileText, TestTube } from "lucide-react";

async function PatientChartContent({
  patientId,
}: {
  patientId: string;
}) {
  const supabase = await createClient();

  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (error || !patient) {
    notFound();
  }

  const { data: vitals } = await supabase
    .from("vital_signs")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(10);

  const { data: problems } = await supabase
    .from("patient_problems")
    .select("*")
    .eq("patient_id", patientId)
    .order("onset_date", { ascending: false });

  const { data: encounters } = await supabase
    .from("encounters")
    .select("*")
    .eq("patient_id", patientId)
    .order("admit_date", { ascending: false })
    .limit(20);

  const { data: medications } = await supabase
    .from("orders")
    .select("id, status, ordered_at, details, is_controlled_substance, med_reconciled_at, med_reconciled_by_name")
    .eq("patient_id", patientId)
    .eq("type", "med")
    .neq("status", "discontinued")
    .order("ordered_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-4">
      <RecordRecentPatient patientId={patientId} />
      <div className="rounded-md border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="px-2 py-1 font-semibold text-slate-700 border-b-2 border-[#1a4d8c]">
            Summary
          </span>
          <Link
            href={`/documentation?patientId=${patientId}`}
            className="inline-flex items-center gap-1 text-[#1a4d8c] hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Documentation
          </Link>
          <Link
            href={`/orders?patientId=${patientId}`}
            className="inline-flex items-center gap-1 text-[#1a4d8c] hover:underline"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Orders
          </Link>
          <Link
            href={`/results?patientId=${patientId}`}
            className="inline-flex items-center gap-1 text-[#1a4d8c] hover:underline"
          >
            <TestTube className="h-3.5 w-3.5" />
            Results
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PatientSummaryBar patient={patient} className="flex-1" />
        <EditDemographicsButton patient={patient} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PatientDemographics patient={patient} />
        <AllergiesPanel allergies={patient.allergies} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ProblemList patientId={patientId} problems={problems || []} />
        <EncounterHistory patientId={patientId} encounters={encounters || []} />
      </div>
      <MedicationListPanel medications={medications || []} />
      <div id="vitals">
        <VitalsPanel patientId={patientId} vitals={vitals || []} />
      </div>
    </div>
  );
}

function ChartFallback() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-12 bg-gray-200 rounded" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-40 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
      <div className="h-48 bg-gray-200 rounded" />
    </div>
  );
}

export default async function PatientChartPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  return (
    <Suspense fallback={<ChartFallback />}>
      <PatientChartContent patientId={patientId} />
    </Suspense>
  );
}
