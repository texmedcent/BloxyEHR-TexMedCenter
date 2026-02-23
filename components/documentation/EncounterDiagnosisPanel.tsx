"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ICD10PickerModal } from "./ICD10PickerModal";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";
import { Stethoscope, Search, AlertTriangle, CheckCircle2 } from "lucide-react";

interface EncounterDiagnosisPanelProps {
  encounterId: string;
  initialCode: string | null;
  initialDescription: string | null;
  initialDdx: string | null;
  initialPlan: string | null;
  currentUserRole: string | null;
  onSaved: () => void;
}

export function EncounterDiagnosisPanel({
  encounterId,
  initialCode,
  initialDescription,
  initialDdx,
  initialPlan,
  currentUserRole,
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
  const canSubmitTreatmentPlan = hasRolePermission(
    currentUserRole,
    "submit_treatment_plan"
  );

  const selectCode = (nextCode: string, nextLabel: string) => {
    setCode(nextCode);
    setDescription(nextLabel);
    setQuery(`${nextCode} - ${nextLabel}`);
  };

  const saveDiagnosis = async () => {
    if (!canSubmitTreatmentPlan) {
      setMessage(
        `Your role (${formatRoleLabel(
          currentUserRole
        )}) cannot submit final diagnosis/treatment plans.`
      );
      return;
    }
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
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          Diagnosis & Treatment Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-4">
          <Label className="text-sm font-medium">ICD-10</Label>
          <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5 mb-2">
            Search or browse the ICD-10 catalog.
          </p>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={() => setPickerOpen(true)}
              disabled={!canSubmitTreatmentPlan}
              placeholder='Search "fracture", "burn", "W54"…'
              className="flex-1 rounded-lg"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={!canSubmitTreatmentPlan}
              className="gap-1.5 shrink-0"
            >
              <Search className="h-4 w-4" />
              Browse
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-sm">Final Diagnosis Code</Label>
            <Input
              className="mt-1.5 rounded-lg"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!canSubmitTreatmentPlan}
              placeholder="e.g. W54.0XXA"
            />
          </div>
          <div>
            <Label className="text-sm">Final Diagnosis Description</Label>
            <Input
              className="mt-1.5 rounded-lg"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canSubmitTreatmentPlan}
              placeholder="Diagnosis text"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm">Differential Diagnosis (DDx)</Label>
          <Textarea
            className="mt-1.5 min-h-[80px] rounded-lg"
            value={ddx}
            onChange={(e) => setDdx(e.target.value)}
            disabled={!canSubmitTreatmentPlan}
            placeholder="List possible diagnoses considered."
          />
        </div>

        <div>
          <Label className="text-sm">Final Treatment Plan</Label>
          <Textarea
            className="mt-1.5 min-h-[100px] rounded-lg"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={!canSubmitTreatmentPlan}
            placeholder="Document definitive treatment plan."
          />
        </div>

        {!canSubmitTreatmentPlan && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Read-only for {formatRoleLabel(currentUserRole)}. A provider role is required.
          </div>
        )}

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              message.startsWith("Failed")
                ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
            }`}
          >
            {message.startsWith("Failed") ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            {message}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={saveDiagnosis}
            disabled={saving || !canSubmitTreatmentPlan}
          >
            {saving ? "Saving…" : "Save Diagnosis"}
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
