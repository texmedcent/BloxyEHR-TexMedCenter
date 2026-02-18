"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ICD10PickerModal } from "./ICD10PickerModal";

interface EncounterDiagnosisPanelProps {
  encounterId: string;
  initialCode: string | null;
  initialDescription: string | null;
  initialDdx: string | null;
  initialPlan: string | null;
  onSaved: () => void;
}

export function EncounterDiagnosisPanel({
  encounterId,
  initialCode,
  initialDescription,
  initialDdx,
  initialPlan,
  onSaved,
}: EncounterDiagnosisPanelProps) {
  const [query, setQuery] = useState(
    [initialCode || "", initialDescription || ""].filter(Boolean).join(" - ")
  );
  const [code, setCode] = useState(initialCode || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [ddx, setDdx] = useState(initialDdx || "");
  const [plan, setPlan] = useState(initialPlan || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectCode = (nextCode: string, nextLabel: string) => {
    setCode(nextCode);
    setDescription(nextLabel);
    setQuery(`${nextCode} - ${nextLabel}`);
  };

  const saveDiagnosis = async () => {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("encounters")
      .update({
        final_diagnosis_code: code || null,
        final_diagnosis_description: description || null,
        differential_diagnosis: ddx || null,
        final_treatment_plan: plan || null,
        diagnosis_updated_at: new Date().toISOString(),
      })
      .eq("id", encounterId);
    setSaving(false);

    if (error) {
      setMessage(`Failed to save: ${error.message}`);
      return;
    }

    setMessage("Diagnosis and treatment plan saved.");
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Diagnosis & Treatment Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>ICD-10</Label>
          <div className="mt-1 flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={() => setPickerOpen(true)}
              placeholder='Click to open picker (or type "fracture", "burn", "W54")'
            />
            <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
              Browse ICD-10
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Opens a full searchable ICD-10 list with favorites.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Final Diagnosis Code</Label>
            <Input
              className="mt-1"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. W54.0XXA"
            />
          </div>
          <div>
            <Label>Final Diagnosis Description</Label>
            <Input
              className="mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Diagnosis text"
            />
          </div>
        </div>

        <div>
          <Label>Differential Diagnosis (DDx)</Label>
          <Textarea
            className="mt-1 min-h-[90px]"
            value={ddx}
            onChange={(e) => setDdx(e.target.value)}
            placeholder="List possible diagnoses considered."
          />
        </div>

        <div>
          <Label>Final Treatment Plan</Label>
          <Textarea
            className="mt-1 min-h-[110px]"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="Document definitive treatment plan."
          />
        </div>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        <div className="flex justify-end">
          <Button onClick={saveDiagnosis} disabled={saving}>
            {saving ? "Saving..." : "Save Diagnosis"}
          </Button>
        </div>
      </CardContent>
      <ICD10PickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(picked) => {
          selectCode(picked.code, picked.label);
        }}
      />
    </Card>
  );
}
