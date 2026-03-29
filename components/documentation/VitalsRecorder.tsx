"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAbnormalVital } from "@/lib/vitals";

interface VitalSign {
  id: string;
  type: string;
  value: string;
  unit: string | null;
  recorded_at: string;
}

const UNIT_BY_TYPE: Record<string, string> = {
  blood_pressure: "mmHg",
  heart_rate: "bpm",
  respiratory_rate: "breaths/min",
  temperature: "F",
  spo2: "%",
  weight: "kg",
  height: "cm",
  pain_score: "/10",
};

const VITAL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "blood_pressure", label: "Blood Pressure" },
  { value: "heart_rate", label: "Heart Rate" },
  { value: "respiratory_rate", label: "Respiratory Rate" },
  { value: "temperature", label: "Temperature" },
  { value: "spo2", label: "SpO2" },
  { value: "pain_score", label: "Pain Score" },
  { value: "weight", label: "Weight" },
  { value: "height", label: "Height" },
];

const VITAL_PLACEHOLDER: Record<string, string> = {
  blood_pressure: "e.g. 120/80",
  heart_rate: "e.g. 82",
  respiratory_rate: "e.g. 16",
  temperature: "e.g. 98.6",
  spo2: "e.g. 98",
  pain_score: "e.g. 4",
  weight: "e.g. 75",
  height: "e.g. 175",
};

const QUICK_VALUES_BY_TYPE: Record<string, string[]> = {
  blood_pressure: ["120/80", "110/70", "140/90"],
  heart_rate: ["72", "88", "110"],
  respiratory_rate: ["14", "16", "22"],
  temperature: ["98.6", "100.4", "102.0"],
  spo2: ["98", "95", "92"],
  pain_score: ["0", "5", "10"],
  weight: ["70", "80", "90"],
  height: ["160", "170", "180"],
};

const normalizeType = (raw: string) =>
  raw.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function VitalsRecorder({
  patientId,
  initialVitals,
  activeEncounterId,
}: {
  patientId: string;
  initialVitals: VitalSign[];
  activeEncounterId: string | null;
}) {
  const router = useRouter();
  const [vitals, setVitals] = useState(initialVitals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("blood_pressure");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(UNIT_BY_TYPE.blood_pressure);
  const [customUnitEnabled, setCustomUnitEnabled] = useState(false);

  const handleTypeChange = (nextType: string) => {
    setType(nextType);
    setUnit(UNIT_BY_TYPE[nextType] ?? "");
    setCustomUnitEnabled(false);
  };

  const saveVital = async () => {
    if (!activeEncounterId) {
      setError("No active encounter. Start an encounter to chart vitals.");
      return;
    }
    if (!value.trim()) {
      setError("Please enter a value.");
      return;
    }

    setError(null);
    setSaving(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const nowIso = new Date().toISOString();

    const { data, error: insertError } = await supabase
      .from("vital_signs")
      .upsert({
        patient_id: patientId,
        encounter_id: activeEncounterId,
        type,
        value: value.trim(),
        unit: unit.trim() || null,
        recorded_at: nowIso,
        recorded_by: user?.id ?? null,
      }, { onConflict: "patient_id,type" })
      .select("id, type, value, unit, recorded_at")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (data) {
      setVitals((prev) => {
        const savedType = normalizeType(data.type);
        const existingIndex = prev.findIndex((v) => normalizeType(v.type) === savedType);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = data;
          return next.sort(
            (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
          );
        }
        return [data, ...prev];
      });
      setValue("");
      router.refresh();
    }
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          Vitals
        </CardTitle>
        <Link
          href={`/chart/${patientId}#vitals`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Quick View in Summary
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {VITAL_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTypeChange(option.value)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border px-2 text-xs",
                  type === option.value
                    ? "border-primary dark:border-primary bg-blue-50 dark:bg-primary/10 font-medium text-primary"
                    : "border-slate-300 dark:border-input bg-white dark:bg-background text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted/50"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_110px_auto] md:items-end">
            <div>
              <Label>Value</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={VITAL_PLACEHOLDER[type] || "Enter value"}
                className="mt-1 bg-background text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveVital();
                  }
                }}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Unit</Label>
                <label className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={customUnitEnabled}
                    onChange={(e) => setCustomUnitEnabled(e.target.checked)}
                  />
                  Edit
                </label>
              </div>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 bg-background text-foreground"
                readOnly={!customUnitEnabled}
              />
            </div>
            <div>
              <Button
                onClick={saveVital}
                disabled={saving || !activeEncounterId}
                className="h-9 w-full md:w-auto"
                title={!activeEncounterId ? "No active encounter selected" : undefined}
              >
                {saving ? "Saving..." : "Add Vital"}
              </Button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {(QUICK_VALUES_BY_TYPE[type] || []).map((quickValue) => (
              <button
                key={quickValue}
                type="button"
                onClick={() => setValue(quickValue)}
                className={cn(
                  "rounded border px-2 py-0.5 text-[11px]",
                  value === quickValue
                    ? "border-primary dark:border-primary bg-blue-50 dark:bg-primary/10 text-primary"
                    : "border-slate-300 dark:border-input bg-white dark:bg-background text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted/50"
                )}
              >
                {quickValue}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!activeEncounterId && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Vitals are encounter-scoped and only charted during an active encounter.
          </div>
        )}

        {vitals.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">No vitals recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50">
                  <th className="py-2 pr-4 text-left font-semibold text-slate-700 dark:text-foreground">Type</th>
                  <th className="py-2 pr-4 text-left font-semibold text-slate-700 dark:text-foreground">Value</th>
                  <th className="py-2 text-left font-semibold text-slate-700 dark:text-foreground">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {vitals.slice(0, 8).map((v) => {
                  const abnormal = isAbnormalVital(v.type, v.value, v.unit);
                  return (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 capitalize">
                        {v.type.replaceAll("_", " ")}
                        {abnormal && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Abnormal
                          </span>
                        )}
                      </td>
                      <td className={cn("py-2 pr-4", abnormal && "font-semibold text-red-600 dark:text-red-400")}>
                        {v.value}
                        {v.unit ? <span className="text-slate-500 dark:text-muted-foreground"> {v.unit}</span> : null}
                      </td>
                      <td className="py-2 text-slate-500 dark:text-muted-foreground">
                        {format(new Date(v.recorded_at), "MM/dd/yyyy HH:mm")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
