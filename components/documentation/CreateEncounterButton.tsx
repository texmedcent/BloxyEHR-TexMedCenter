"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
  const [type, setType] = useState<"inpatient" | "outpatient" | "ed">(
    "outpatient"
  );

  const handleCreate = async () => {
    onLoadingChange(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("encounters")
      .insert({
        patient_id: patientId,
        type,
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
      <p className="text-sm text-gray-500">No encounters yet.</p>
      <div className="flex gap-2 flex-wrap">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "inpatient" | "outpatient" | "ed")}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="outpatient">Outpatient</option>
          <option value="inpatient">Inpatient</option>
          <option value="ed">Emergency</option>
        </select>
        <Button size="sm" onClick={handleCreate} disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Encounter"}
        </Button>
      </div>
    </div>
  );
}
