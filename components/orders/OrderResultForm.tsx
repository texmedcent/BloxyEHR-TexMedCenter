"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface OrderResultFormProps {
  order: {
    id: string;
    type: string;
    patient_id: string;
  };
  existingResult?: {
    id: string;
    status: string;
    value: unknown;
    reported_at: string;
  };
  mode?: "result" | "note";
  onClose: () => void;
  onSaved: () => void;
}

export function OrderResultForm({
  order,
  existingResult,
  mode = "result",
  onClose,
  onSaved,
}: OrderResultFormProps) {
  const [status, setStatus] = useState(existingResult?.status || "preliminary");
  const [valueInput, setValueInput] = useState(
    existingResult?.value
      ? typeof existingResult.value === "string"
        ? existingResult.value
        : JSON.stringify(existingResult.value, null, 2)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();

    let parsedValue: Record<string, unknown> = {};
    try {
      if (valueInput.trim()) {
        parsedValue = JSON.parse(valueInput) as Record<string, unknown>;
      } else {
        parsedValue = { note: "" };
      }
    } catch {
      parsedValue = { note: valueInput };
    }

    const payload = {
      order_id: order.id,
      patient_id: order.patient_id,
      type: order.type,
      value: parsedValue,
      status,
      reported_at: new Date().toISOString(),
    };

    const { error: insertError } = existingResult?.id
      ? await supabase.from("results").update(payload).eq("id", existingResult.id)
      : await supabase.from("results").insert(payload);

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("orders")
      .update({
        status: mode === "result" && status !== "final" ? "pending" : "completed",
      })
      .eq("id", order.id);

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {mode === "note"
              ? `${existingResult ? "Update" : "Add"} ${order.type} Note`
              : `${existingResult ? "Update" : "Enter"} ${order.type} Result`}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>{mode === "note" ? "Entry Status" : "Result Status"}</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
              >
                {mode === "result" && <option value="pending">Pending</option>}
                <option value="preliminary">Preliminary</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <Label>
                {mode === "note" ? "Clinical Note (JSON or text)" : "Result Value (JSON or text)"}
              </Label>
              <Textarea
                className="mt-1 min-h-[140px]"
                placeholder={
                  mode === "note"
                    ? 'e.g. "Medication administered without adverse reaction"'
                    : 'e.g. {"finding":"No acute cardiopulmonary abnormality","impression":"Normal chest X-ray"}'
                }
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : mode === "note" ? "Save Note" : "Save Result"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
