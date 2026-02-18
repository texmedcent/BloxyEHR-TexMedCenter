"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Encounter {
  id: string;
  type: string;
  admit_date: string | null;
  discharge_date: string | null;
  status: string;
  final_diagnosis_code?: string | null;
  final_diagnosis_description?: string | null;
}

interface EncounterHistoryProps {
  patientId: string;
  encounters: Encounter[];
}

export function EncounterHistory({
  patientId,
  encounters,
}: EncounterHistoryProps) {
  const router = useRouter();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [encounterType, setEncounterType] = useState<"outpatient" | "inpatient" | "ed">(
    "outpatient"
  );

  const endEncounter = async (encounterId: string) => {
    setEndingId(encounterId);
    const supabase = createClient();

    const nowIso = new Date().toISOString();

    const { error: encounterError } = await supabase
      .from("encounters")
      .update({
        status: "completed",
        discharge_date: nowIso,
      })
      .eq("id", encounterId)
      .eq("status", "active");

    if (encounterError) {
      setEndingId(null);
      return;
    }

    // Close any linked active check-in for this encounter.
    await supabase
      .from("patient_checkins")
      .update({ status: "completed" })
      .eq("encounter_id", encounterId)
      .in("status", ["triage", "in_encounter"]);

    setEndingId(null);
    router.refresh();
  };

  const startNewEncounter = async () => {
    setStarting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: encounter, error } = await supabase
      .from("encounters")
      .insert({
        patient_id: patientId,
        type: encounterType,
        admit_date: new Date().toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (!error && encounter) {
      // If patient is in triage queue, link latest triage check-in to this encounter.
      const { data: latestTriage } = await supabase
        .from("patient_checkins")
        .select("id")
        .eq("patient_id", patientId)
        .eq("status", "triage")
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestTriage?.id) {
        await supabase
          .from("patient_checkins")
          .update({
            status: "in_encounter",
            triaged_at: new Date().toISOString(),
            triaged_by: user?.id ?? null,
            encounter_id: encounter.id,
          })
          .eq("id", latestTriage.id);
      }
    }

    setStarting(false);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Encounter History</CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={encounterType}
            onChange={(e) =>
              setEncounterType(e.target.value as "outpatient" | "inpatient" | "ed")
            }
            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
          >
            <option value="outpatient">Outpatient</option>
            <option value="inpatient">Inpatient</option>
            <option value="ed">Emergency</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={startNewEncounter}
            disabled={starting}
          >
            {starting ? "Starting..." : "Start New Encounter"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {encounters.length === 0 ? (
          <p className="text-sm text-gray-500">No encounters</p>
        ) : (
          <ul className="space-y-2">
            {encounters.map((e) => (
              <li key={e.id}>
                <div className="flex items-center justify-between gap-2 rounded border p-2">
                  <Link
                    href={`/documentation?patientId=${patientId}&encounterId=${e.id}`}
                    className="min-w-0 flex-1 hover:text-[#1a4d8c]"
                  >
                    <span className="font-medium capitalize">{e.type}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {e.admit_date
                        ? format(new Date(e.admit_date), "MM/dd/yyyy")
                        : "—"}
                      {e.discharge_date && (
                        <> – {format(new Date(e.discharge_date), "MM/dd/yyyy")}</>
                      )}
                    </span>
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        e.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {e.status}
                    </span>
                    {e.status === "completed" &&
                      (e.final_diagnosis_code || e.final_diagnosis_description) && (
                        <span className="ml-2 text-xs text-slate-700">
                          Dx: {e.final_diagnosis_code || ""}{" "}
                          {e.final_diagnosis_description || ""}
                        </span>
                      )}
                  </Link>
                  {e.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => endEncounter(e.id)}
                      disabled={endingId === e.id}
                    >
                      {endingId === e.id ? "Ending..." : "End Encounter"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
