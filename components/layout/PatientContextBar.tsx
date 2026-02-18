"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PatientSummaryBar } from "@/components/chart/PatientSummaryBar";
import { FileText, ClipboardList, TestTube, ArrowLeft } from "lucide-react";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string | null;
  allergies?: unknown;
}

export function PatientContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);

  const isOnChartPage = pathname?.match(/^\/chart\/[a-f0-9-]+$/);
  const patientId =
    pathname?.match(/^\/chart\/([a-f0-9-]+)$/)?.[1] ||
    searchParams?.get("patientId");

  useEffect(() => {
    // Keep hook order stable; just clear/hide context when not needed.
    if (!patientId || isOnChartPage) {
      setPatient(null);
      return;
    }

    const fetchPatient = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();
      setPatient(data);
    };

    fetchPatient();
  }, [patientId, isOnChartPage]);

  // Don't show context bar on chart page - chart has its own summary.
  if (!patient || isOnChartPage) return null;

  return (
    <div className="border-b bg-white px-4 py-2">
      <div className="mb-2 flex items-center gap-3 text-sm">
        <Link
          href={`/chart/${patientId}`}
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Chart
        </Link>
        <Link
          href={`/chart/${patientId}`}
          className="font-medium text-[#1a4d8c] hover:underline"
        >
          {patient.last_name}, {patient.first_name}
        </Link>
      </div>
      <PatientSummaryBar patient={patient} />
      <div className="flex gap-2 mt-2 flex-wrap">
        <Link
          href={`/documentation?patientId=${patientId}`}
          className="text-sm text-[#1a4d8c] hover:underline flex items-center gap-1"
        >
          <FileText className="h-3.5 w-3.5" />
          Documentation
        </Link>
        <Link
          href={`/orders?patientId=${patientId}`}
          className="text-sm text-[#1a4d8c] hover:underline flex items-center gap-1"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Orders
        </Link>
        <Link
          href={`/results?patientId=${patientId}`}
          className="text-sm text-[#1a4d8c] hover:underline flex items-center gap-1"
        >
          <TestTube className="h-3.5 w-3.5" />
          Results
        </Link>
      </div>
    </div>
  );
}
