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

const normalizeType = (raw: string) =>
  raw.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function VitalsRecorder({
  patientId,
  initialVitals,
}: {
  patientId: string;
  initialVitals: VitalSign[];
}) {
  const router = useRouter();
  const [vitals, setVitals] = useState(initialVitals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("blood_pressure");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(UNIT_BY_TYPE.blood_pressure);

  const handleTypeChange = (nextType: string) => {
    setType(nextType);
    setUnit(UNIT_BY_TYPE[nextType] ?? "");
  };

  const saveVital = async () => {
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Vitals
        </CardTitle>
        <Link
          href={`/chart/${patientId}#vitals`}
          className="text-xs font-medium text-[#1a4d8c] hover:underline"
        >
          Quick View in Summary
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px_1fr_130px_auto]">
          <div>
            <Label>Type</Label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="blood_pressure">Blood Pressure</option>
              <option value="heart_rate">Heart Rate</option>
              <option value="respiratory_rate">Respiratory Rate</option>
              <option value="temperature">Temperature</option>
              <option value="spo2">SpO2</option>
              <option value="weight">Weight</option>
              <option value="height">Height</option>
              <option value="pain_score">Pain Score</option>
            </select>
          </div>
          <div>
            <Label>Value</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "blood_pressure" ? "e.g. 120/80" : "Enter value"}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button onClick={saveVital} disabled={saving} className="h-9 w-full md:w-auto">
              {saving ? "Saving..." : "Add Vital"}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {vitals.length === 0 ? (
          <p className="text-sm text-slate-500">No vitals recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="py-2 pr-4 text-left font-semibold text-slate-600">Type</th>
                  <th className="py-2 pr-4 text-left font-semibold text-slate-600">Value</th>
                  <th className="py-2 text-left font-semibold text-slate-600">Recorded</th>
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
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            Abnormal
                          </span>
                        )}
                      </td>
                      <td className={cn("py-2 pr-4", abnormal && "font-semibold text-red-600")}>
                        {v.value}
                        {v.unit ? <span className="text-slate-500"> {v.unit}</span> : null}
                      </td>
                      <td className="py-2 text-slate-500">
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
