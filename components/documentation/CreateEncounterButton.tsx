"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FALLBACK_CAMPUSES, normalizeCareSetting, careSettingToEncounterType, type CampusOption, type CareSetting } from "@/lib/campuses";

interface CreateEncounterButtonProps {
  patientId: string;
  onCreated: (encounterId: string) => void;
  isLoading: boolean;
  onLoadingChange: (v: boolean) => void;
}

export function CreateEncounterButton({
  patientId,
  onCreated,
  isLoading,
  onLoadingChange,
}: CreateEncounterButtonProps) {
  const [campuses, setCampuses] = useState<CampusOption[]>(FALLBACK_CAMPUSES);
  const [campus, setCampus] = useState<string>(FALLBACK_CAMPUSES[0]?.name || "Primary Care Office");
  const [careSetting, setCareSetting] = useState<CareSetting>("outpatient");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("institution_campuses")
        .select("id, name, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        setCampuses(data);
        setCampus((current) => (data.some((campusRow) => campusRow.name === current) ? current : data[0].name));
      }
    })();
  }, []);

  const handleCreate = async () => {
    onLoadingChange(true);
    const supabase = createClient();
    const normalizedCareSetting = normalizeCareSetting(careSetting);
    const encounterType = careSettingToEncounterType(normalizedCareSetting);
    const { data, error } = await supabase
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
    onLoadingChange(false);
    if (error || !data) {
      console.error(error);
      return;
    }
    onCreated(data.id);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">No encounters yet.</p>
      <div className="flex gap-2 flex-wrap">
        <select
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1 text-sm"
        >
          {campuses.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={careSetting}
          onChange={(e) => setCareSetting(normalizeCareSetting(e.target.value))}
          className="rounded border border-input bg-background px-2 py-1 text-sm"
        >
          <option value="outpatient">Outpatient</option>
          <option value="inpatient">Inpatient</option>
        </select>
        <Button size="sm" onClick={handleCreate} disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Encounter"}
        </Button>
      </div>
    </div>
  );
}
