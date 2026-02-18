"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function campusToEncounterType(campus: string): "ed" | "outpatient" {
  if (campus === "Emergency Room") return "ed";
  return "outpatient";
}

export function StartEncounterButton({
  checkinId,
  patientId,
  campus,
}: {
  checkinId: string;
  patientId: string;
  campus: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const startEncounter = async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const encounterType = campusToEncounterType(campus);
    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .insert({
        patient_id: patientId,
        type: encounterType,
        admit_date: new Date().toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (encounterError || !encounter) {
      setLoading(false);
      return;
    }

    await supabase
      .from("patient_checkins")
      .update({
        status: "in_encounter",
        triaged_at: new Date().toISOString(),
        triaged_by: user.id,
        encounter_id: encounter.id,
      })
      .eq("id", checkinId);

    setLoading(false);
    router.refresh();
    router.push(`/chart/${patientId}`);
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={startEncounter}
      disabled={loading}
      className="h-8"
    >
      {loading ? "Starting..." : "Start Encounter"}
    </Button>
  );
}
