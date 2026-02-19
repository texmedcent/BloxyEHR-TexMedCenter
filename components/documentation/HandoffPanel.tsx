"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";

interface HandoffPanelProps {
  patientId: string;
  encounterId: string;
  currentUserRole: string | null;
}

interface HandoffRow {
  id: string;
  from_user_name: string | null;
  to_user_name: string | null;
  status: string;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  sbar: Record<string, unknown>;
}

export function HandoffPanel({
  patientId,
  encounterId,
  currentUserRole,
}: HandoffPanelProps) {
  const [rows, setRows] = useState<HandoffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toUserName, setToUserName] = useState("");
  const [situation, setSituation] = useState("");
  const [background, setBackground] = useState("");
  const [assessment, setAssessment] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canCompleteHandoff = hasRolePermission(currentUserRole, "complete_handoff");

  const loadRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("encounter_handoffs")
      .select("id, from_user_name, to_user_name, status, accepted_at, completed_at, created_at, sbar")
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(10);
    setRows((data || []) as HandoffRow[]);
    setLoading(false);
  }, [encounterId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const createHandoff = async () => {
    if (!canCompleteHandoff) {
      setMessage(`Role ${formatRoleLabel(currentUserRole)} cannot create handoffs.`);
      return;
    }
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
    const { error } = await supabase.from("encounter_handoffs").insert({
      encounter_id: encounterId,
      patient_id: patientId,
      from_user_id: user.id,
      from_user_name: profile?.full_name || user.email || "Clinician",
      to_user_name: toUserName.trim() || null,
      sbar: {
        situation,
        background,
        assessment,
        recommendation,
      },
      status: "pending",
    });
    setSaving(false);
    if (error) {
      setMessage(`Failed to create handoff: ${error.message}`);
      return;
    }
    setToUserName("");
    setSituation("");
    setBackground("");
    setAssessment("");
    setRecommendation("");
    setMessage("Handoff created.");
    void loadRows();
  };

  const updateHandoffStatus = async (handoffId: string, status: "accepted" | "completed") => {
    if (!canCompleteHandoff) return;
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const updates =
      status === "accepted"
        ? { status, accepted_at: nowIso }
        : { status, completed_at: nowIso };
    await supabase.from("encounter_handoffs").update(updates).eq("id", handoffId);
    void loadRows();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SBAR Handoff</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>To (Clinician Name)</Label>
            <Input
              className="mt-1"
              value={toUserName}
              onChange={(e) => setToUserName(e.target.value)}
              placeholder="Receiving clinician"
            />
          </div>
        </div>
        <div>
          <Label>Situation</Label>
          <Textarea
            className="mt-1 min-h-[70px]"
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
          />
        </div>
        <div>
          <Label>Background</Label>
          <Textarea
            className="mt-1 min-h-[70px]"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
          />
        </div>
        <div>
          <Label>Assessment</Label>
          <Textarea
            className="mt-1 min-h-[70px]"
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
          />
        </div>
        <div>
          <Label>Recommendation</Label>
          <Textarea
            className="mt-1 min-h-[70px]"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button onClick={createHandoff} disabled={saving || !canCompleteHandoff}>
            {saving ? "Saving..." : "Create Handoff"}
          </Button>
          {message && <p className="text-xs text-slate-600">{message}</p>}
        </div>

        <div className="rounded border border-slate-200 p-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Recent Handoffs
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No handoffs yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {rows.map((row) => (
                <li key={row.id} className="rounded bg-slate-50 p-2">
                  <p className="font-medium text-slate-700">
                    {row.from_user_name || "Clinician"} → {row.to_user_name || "Unassigned"} ·{" "}
                    {row.status}
                  </p>
                  <p className="text-slate-600">
                    S: {String(row.sbar?.situation || "—")} | A:{" "}
                    {String(row.sbar?.assessment || "—")}
                  </p>
                  <p className="text-slate-500">
                    {format(new Date(row.created_at), "MM/dd HH:mm")}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {row.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => updateHandoffStatus(row.id, "accepted")}
                        disabled={!canCompleteHandoff}
                      >
                        Mark Accepted
                      </Button>
                    )}
                    {row.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => updateHandoffStatus(row.id, "completed")}
                        disabled={!canCompleteHandoff}
                      >
                        Mark Completed
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
