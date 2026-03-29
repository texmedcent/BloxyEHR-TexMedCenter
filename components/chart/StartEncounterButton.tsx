"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { careSettingToEncounterType, normalizeCareSetting } from "@/lib/campuses";

export function StartEncounterButton({
  checkinId,
  patientId,
  campus,
  careSetting,
}: {
  checkinId: string;
  patientId: string;
  campus: string;
  careSetting?: string | null;
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

    const normalizedCareSetting = normalizeCareSetting(careSetting);
    const encounterType = careSettingToEncounterType(normalizedCareSetting);
    const { data: encounter, error: encounterError } = await supabase
      .from("encounters")
      .insert({
        patient_id: patientId,
        type: encounterType,
        campus,
        care_setting: normalizedCareSetting,
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
