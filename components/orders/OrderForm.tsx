"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface OrderFormProps {
  patientId: string;
  onClose: () => void;
  onSaved: () => void;
}

const ORDER_TYPES = ["med", "lab", "imaging", "procedure"] as const;

export function OrderForm({ patientId, onClose, onSaved }: OrderFormProps) {
  const [type, setType] = useState<"med" | "lab" | "imaging" | "procedure">(
    "lab"
  );
  const [details, setDetails] = useState("");
  const [medication, setMedication] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [indication, setIndication] = useState("");
  const [isControlledSubstance, setIsControlledSubstance] = useState(false);
  const [controlledCode, setControlledCode] = useState("");
  const [allergyList, setAllergyList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadAllergies = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("allergies")
        .eq("id", patientId)
        .maybeSingle();

      const parsed = Array.isArray(data?.allergies)
        ? (data?.allergies as { allergen?: string }[])
            .map((a) => a?.allergen?.trim())
            .filter((x): x is string => Boolean(x))
        : [];

      setAllergyList(parsed);
    };

    void loadAllergies();
  }, [patientId]);

  const possibleAllergyConflict = useMemo(() => {
    if (type !== "med" || !medication.trim()) return null;
    const med = medication.toLowerCase();
    return allergyList.find((a) => med.includes(a.toLowerCase())) ?? null;
  }, [type, medication, allergyList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    let parsedDetails: Record<string, string> = {};
    if (type === "med") {
      if (!medication.trim()) {
        setError("Medication name is required.");
        setSaving(false);
        return;
      }
      if (isControlledSubstance && !controlledCode.trim()) {
        setError("Controlled substance authorization code is required.");
        setSaving(false);
        return;
      }
      parsedDetails = {
        medication: medication.trim(),
        dose: dose.trim(),
        route: route.trim(),
        frequency: frequency.trim(),
        duration: duration.trim(),
        indication: indication.trim(),
        ...(isControlledSubstance ? { controlled_code: controlledCode.trim() } : {}),
      };
    } else {
      try {
        if (details.trim()) {
          parsedDetails = JSON.parse(details) as Record<string, string>;
        }
      } catch {
        parsedDetails = { note: details };
      }
    }

    const { error } = await supabase.from("orders").insert({
      patient_id: patientId,
      type,
      details: parsedDetails,
      is_controlled_substance: type === "med" ? isControlledSubstance : false,
      status: "pending",
      ordered_by: user.id,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Place Order</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Order Type</Label>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "med" | "lab" | "imaging" | "procedure")
                }
                className="mt-1 w-full rounded border px-3 py-2"
              >
                {ORDER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            {type === "med" ? (
              <div className="space-y-3 rounded border border-slate-200 p-3">
                <div>
                  <Label>Medication</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Amoxicillin"
                    value={medication}
                    onChange={(e) => setMedication(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Dose</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. 500 mg"
                      value={dose}
                      onChange={(e) => setDose(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Route</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. PO"
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. BID"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Input
                      className="mt-1"
                      placeholder="e.g. 7 days"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Indication</Label>
                  <Input
                    className="mt-1"
                    placeholder="Reason for medication"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                  />
                </div>
                <div className="rounded border border-slate-200 p-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={isControlledSubstance}
                      onChange={(e) => setIsControlledSubstance(e.target.checked)}
                    />
                    This is a controlled substance
                  </label>
                  {isControlledSubstance && (
                    <div className="mt-2">
                      <Label>Authorization Code</Label>
                      <Input
                        className="mt-1"
                        value={controlledCode}
                        onChange={(e) => setControlledCode(e.target.value)}
                        placeholder="Enter controlled-substance code"
                      />
                    </div>
                  )}
                </div>
                {possibleAllergyConflict && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Allergy alert: this may conflict with recorded allergy "{possibleAllergyConflict}".
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label>Details (JSON or free text)</Label>
                <Textarea
                  className="mt-1 min-h-[90px]"
                  placeholder='e.g. {"test":"CBC","priority":"STAT"}, or free text'
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Placing..." : "Place Order"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
