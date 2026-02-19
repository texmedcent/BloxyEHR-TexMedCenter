"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface NursingFlowsheetPanelProps {
  patientId: string;
  encounterId: string;
}

interface FlowsheetRow {
  id: string;
  assessment: Record<string, unknown>;
  intake_output: Record<string, unknown>;
  reassess_due_at: string | null;
  recorded_by_name: string | null;
  updated_at: string;
}

export function NursingFlowsheetPanel({ patientId, encounterId }: NursingFlowsheetPanelProps) {
  const [rows, setRows] = useState<FlowsheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [neuro, setNeuro] = useState("");
  const [respiratory, setRespiratory] = useState("");
  const [cardiac, setCardiac] = useState("");
  const [intakeMl, setIntakeMl] = useState("");
  const [outputMl, setOutputMl] = useState("");
  const [reassessDueAt, setReassessDueAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("nursing_flowsheets")
      .select("id, assessment, intake_output, reassess_due_at, recorded_by_name, updated_at")
      .eq("encounter_id", encounterId)
      .order("updated_at", { ascending: false })
      .limit(10);
    setRows((data || []) as FlowsheetRow[]);
    setLoading(false);
  }, [encounterId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const saveFlowsheet = async () => {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const payload = {
      encounter_id: encounterId,
      patient_id: patientId,
      assessment: {
        neuro,
        respiratory,
        cardiac,
      },
      intake_output: {
        intake_ml: intakeMl || null,
        output_ml: outputMl || null,
      },
      reassess_due_at: reassessDueAt ? new Date(reassessDueAt).toISOString() : null,
      recorded_by: user.id,
      recorded_by_name: profile?.full_name || user.email || "Clinician",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("nursing_flowsheets").insert(payload);
    setSaving(false);
    if (error) {
      setMessage(`Failed to save: ${error.message}`);
      return;
    }
    setNeuro("");
    setRespiratory("");
    setCardiac("");
    setIntakeMl("");
    setOutputMl("");
    setReassessDueAt("");
    setMessage("Flowsheet entry recorded.");
    void loadRows();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nursing Flowsheet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Neuro</Label>
            <Textarea
              className="mt-1 min-h-[70px]"
              value={neuro}
              onChange={(e) => setNeuro(e.target.value)}
              placeholder="A/O, pupils, deficits"
            />
          </div>
          <div>
            <Label>Respiratory</Label>
            <Textarea
              className="mt-1 min-h-[70px]"
              value={respiratory}
              onChange={(e) => setRespiratory(e.target.value)}
              placeholder="Breath sounds, effort"
            />
          </div>
          <div>
            <Label>Cardiac</Label>
            <Textarea
              className="mt-1 min-h-[70px]"
              value={cardiac}
              onChange={(e) => setCardiac(e.target.value)}
              placeholder="Rhythm, perfusion"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Intake (mL)</Label>
            <Input
              className="mt-1"
              value={intakeMl}
              onChange={(e) => setIntakeMl(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Output (mL)</Label>
            <Input
              className="mt-1"
              value={outputMl}
              onChange={(e) => setOutputMl(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Reassessment Due</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              value={reassessDueAt}
              onChange={(e) => setReassessDueAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button onClick={saveFlowsheet} disabled={saving}>
            {saving ? "Saving..." : "Add Flowsheet Entry"}
          </Button>
          {message && <p className="text-xs text-slate-600">{message}</p>}
        </div>

        <div className="rounded border border-slate-200 p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Recent Entries
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No flowsheet entries yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {rows.map((row) => (
                <li key={row.id} className="rounded bg-slate-50 p-2">
                  <p className="font-medium text-slate-700">
                    {row.recorded_by_name || "Clinician"} ·{" "}
                    {format(new Date(row.updated_at), "MM/dd HH:mm")}
                  </p>
                  <p className="text-slate-600">
                    Neuro: {String(row.assessment?.neuro || "—")} · Respiratory:{" "}
                    {String(row.assessment?.respiratory || "—")} · Cardiac:{" "}
                    {String(row.assessment?.cardiac || "—")}
                  </p>
                  <p className="text-slate-600">
                    I/O: {String(row.intake_output?.intake_ml || "—")} /{" "}
                    {String(row.intake_output?.output_ml || "—")} mL
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
