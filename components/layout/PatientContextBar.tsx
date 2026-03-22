"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PatientSummaryBar } from "@/components/chart/PatientSummaryBar";
import {
  FileText,
  ClipboardList,
  ClipboardCheck,
  TestTube,
  ArrowLeft,
} from "lucide-react";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string | null;
  allergies?: unknown;
}

interface EncounterOption {
  id: string;
  type: string;
  status: string;
  admit_date: string | null;
}

export function PatientContextBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<EncounterOption[]>([]);

  const chartPatientMatch = pathname?.match(/^\/chart\/([a-f0-9-]+)$/);
  const isOnChartPage = Boolean(chartPatientMatch);
  const patientId = chartPatientMatch?.[1] || searchParams?.get("patientId");
  const selectedEncounterId = searchParams?.get("encounterId") || "";

  useEffect(() => {
    // Keep hook order stable; just clear/hide context when not needed.
    if (!patientId || isOnChartPage) {
      setPatient(null);
      setEncounters([]);
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

      const { data: encounterRows } = await supabase
        .from("encounters")
        .select("id, type, status, admit_date")
        .eq("patient_id", patientId)
        .order("admit_date", { ascending: false })
        .limit(25);
      setEncounters((encounterRows || []) as EncounterOption[]);
    };

    fetchPatient();
  }, [patientId, isOnChartPage]);

  // Don't show context bar on chart page - chart has its own summary.
  if (!patient || isOnChartPage) return null;
  const buildModuleHref = (basePath: string) => {
    const params = new URLSearchParams();
    params.set("patientId", patient.id);
    if (selectedEncounterId) params.set("encounterId", selectedEncounterId);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="border-b bg-white dark:bg-card border-slate-200 dark:border-[hsl(var(--border))] px-4 py-2">
      <div className="mb-2 flex items-center gap-3 text-sm flex-wrap">
        <Link
          href={`/chart/${patientId}`}
          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[hsl(var(--border))] px-2 py-1 text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Chart
        </Link>
        <Link
          href={`/chart/${patientId}`}
          className="font-medium text-primary hover:underline"
        >
          {patient.last_name}, {patient.first_name}
        </Link>
        <div className="inline-flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-muted-foreground">Encounter:</span>
          <select
            value={selectedEncounterId}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams?.toString() || "");
              if (e.target.value) params.set("encounterId", e.target.value);
              else params.delete("encounterId");
              const query = params.toString();
              router.replace(`${pathname}${query ? `?${query}` : ""}`);
            }}
            className="h-8 rounded border border-slate-300 dark:border-[hsl(var(--input))] bg-white dark:bg-background px-2 text-xs"
          >
            <option value="">All Encounters</option>
            {encounters.map((encounter) => (
              <option key={encounter.id} value={encounter.id}>
                {encounter.type} · {encounter.status}
                {encounter.admit_date
                  ? ` · ${new Date(encounter.admit_date).toLocaleDateString()}`
                  : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <PatientSummaryBar patient={patient} />
      <div className="flex gap-2 mt-2 flex-wrap">
        <Link
          href={buildModuleHref("/documentation")}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <FileText className="h-3.5 w-3.5" />
          Documentation
        </Link>
        <Link
          href={buildModuleHref("/orders")}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Orders
        </Link>
        <Link
          href={buildModuleHref("/procedures")}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Procedures
        </Link>
        <Link
          href={buildModuleHref("/results")}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <TestTube className="h-3.5 w-3.5" />
          Results
        </Link>
      </div>
    </div>
  );
}
