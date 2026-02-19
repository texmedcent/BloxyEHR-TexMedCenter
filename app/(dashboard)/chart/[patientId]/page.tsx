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
import { EncounterTrendPanel } from "@/components/chart/EncounterTrendPanel";
import Link from "next/link";
import { ClipboardCheck, ClipboardList, FileText, TestTube } from "lucide-react";

async function PatientChartContent({
  patientId,
}: {
  patientId: string;
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  const { data: currentProfile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    : { data: null };

  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (error || !patient) {
    notFound();
  }

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

  const activeEncounter = (encounters || []).find((encounter) => encounter.status === "active") || null;

  let vitals: {
    id: string;
    type: string;
    value: string;
    unit: string | null;
    recorded_at: string;
  }[] = [];
  let trendLabs: { analyte: string; value: number; reported_at: string }[] = [];
  if (activeEncounter?.id) {
    const { data: v } = await supabase
      .from("vital_signs")
      .select("id, type, value, unit, recorded_at, encounter_id")
      .eq("patient_id", patientId)
      .eq("encounter_id", activeEncounter.id)
      .order("recorded_at", { ascending: false })
      .limit(10);
    vitals = v || [];

    const { data: encounterOrders } = await supabase
      .from("orders")
      .select("id, details")
      .eq("patient_id", patientId)
      .eq("encounter_id", activeEncounter.id)
      .eq("type", "lab");
    const orderById = new Map<string, string>();
    for (const order of encounterOrders || []) {
      const details =
        order.details && typeof order.details === "object" && !Array.isArray(order.details)
          ? (order.details as Record<string, unknown>)
          : {};
      const analyte =
        typeof details.test === "string" ? details.test : typeof details.panel === "string" ? details.panel : "lab";
      orderById.set(order.id, analyte);
    }
    const labOrderIds = Array.from(orderById.keys());
    if (labOrderIds.length > 0) {
      const { data: labResults } = await supabase
        .from("results")
        .select("order_id, value, reported_at")
        .in("order_id", labOrderIds)
        .order("reported_at", { ascending: false })
        .limit(60);
      trendLabs = (labResults || [])
        .map((r) => {
          let numeric: number | null = null;
          if (typeof r.value === "number") numeric = r.value;
          if (typeof r.value === "string") {
            const m = r.value.match(/(\d+(\.\d+)?)/);
            numeric = m ? Number(m[1]) : null;
          }
          if (
            numeric === null &&
            r.value &&
            typeof r.value === "object" &&
            !Array.isArray(r.value)
          ) {
            const obj = r.value as Record<string, unknown>;
            const firstNumeric = Object.values(obj).find((v) => {
              if (typeof v === "number") return true;
              if (typeof v === "string") return Boolean(v.match(/^\d+(\.\d+)?$/));
              return false;
            });
            if (typeof firstNumeric === "number") numeric = firstNumeric;
            if (typeof firstNumeric === "string") numeric = Number(firstNumeric);
          }
          if (numeric === null || Number.isNaN(numeric)) return null;
          return {
            analyte: orderById.get(r.order_id || "") || "lab",
            value: numeric,
            reported_at: r.reported_at,
          };
        })
        .filter((row): row is { analyte: string; value: number; reported_at: string } => Boolean(row));
    }
  }

  const { data: medications } = await supabase
    .from("orders")
    .select("id, status, ordered_at, details, is_controlled_substance, med_reconciled_at, med_reconciled_by_name")
    .eq("patient_id", patientId)
    .eq("type", "med")
    .order("ordered_at", { ascending: false })
    .limit(20);
  const activeMedications = (medications || []).filter(
    (med) => (med.status || "").toLowerCase() !== "discontinued"
  );


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
            href={`/procedures?patientId=${patientId}`}
            className="inline-flex items-center gap-1 text-[#1a4d8c] hover:underline"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Procedures
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
        <div className="flex items-center gap-2">
          <EditDemographicsButton patient={patient} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PatientDemographics patient={patient} />
        <AllergiesPanel allergies={patient.allergies} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ProblemList patientId={patientId} problems={problems || []} />
        <EncounterHistory
          patientId={patientId}
          encounters={encounters || []}
          currentUserRole={currentProfile?.role ?? null}
        />
      </div>
      <MedicationListPanel medications={activeMedications} />
      <EncounterTrendPanel vitals={vitals || []} labs={trendLabs} />
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
