"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addProviderToCareTeam } from "@/lib/care_team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";

interface EncounterEditModalProps {
  encounterId: string;
  patientId: string;
  currentUserRole: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EncounterEditModal({
  encounterId,
  patientId,
  currentUserRole,
  onClose,
  onSaved,
}: EncounterEditModalProps) {
  const [type, setType] = useState<"outpatient" | "inpatient" | "ed">("outpatient");
  const [status, setStatus] = useState<"active" | "completed">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEditEncounter = hasRolePermission(currentUserRole, "edit_encounter");
  const canFinalizeEncounter = hasRolePermission(currentUserRole, "finalize_encounter");

  useEffect(() => {
    const loadEncounter = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("encounters")
        .select("type, status")
        .eq("id", encounterId)
        .maybeSingle();
      if (!data) return;
      setType((data.type as "outpatient" | "inpatient" | "ed") || "outpatient");
      setStatus((data.status as "active" | "completed") || "active");
    };
    void loadEncounter();
  }, [encounterId]);

  const save = async () => {
    if (!canEditEncounter) {
      setError(`Role ${formatRoleLabel(currentUserRole)} cannot edit encounters.`);
      return;
    }
    if (status === "completed" && !canFinalizeEncounter) {
      setError(`Role ${formatRoleLabel(currentUserRole)} cannot finalize encounters.`);
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const profile = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : { data: null };
    const clinicianName = profile.data?.full_name || user?.email || "Clinician";
    const nowIso = new Date().toISOString();

    const updates: Record<string, unknown> = {
      type,
      status,
      last_updated_by: user?.id || null,
      last_updated_by_name: clinicianName,
      last_updated_at: nowIso,
      workflow_status: status === "completed" ? "completed" : "in_progress",
    };
    if (status === "completed") {
      updates.discharge_date = nowIso;
    }

    const { error: updateError } = await supabase
      .from("encounters")
      .update(updates)
      .eq("id", encounterId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await supabase.from("encounter_audit_log").insert({
      encounter_id: encounterId,
      action: "edited_encounter",
      field_changes: { type, status },
      created_by: user?.id || null,
      created_by_name: clinicianName,
    });

    if (user && patientId) {
      await addProviderToCareTeam(supabase, patientId, "encounter_edit");
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Edit Encounter</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Encounter Type</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "outpatient" | "inpatient" | "ed")}
              className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
              disabled={!canEditEncounter}
            >
              <option value="outpatient">Outpatient</option>
              <option value="inpatient">Inpatient</option>
              <option value="ed">Emergency</option>
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "completed")}
              className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
              disabled={!canEditEncounter}
            >
              <option value="active">Active</option>
              <option value="completed" disabled={!canFinalizeEncounter}>
                Completed
              </option>
            </select>
          </div>
          {!canEditEncounter && (
            <p className="text-sm text-amber-700">
              Read-only for {formatRoleLabel(currentUserRole)}.
            </p>
          )}
          {canEditEncounter && !canFinalizeEncounter && (
            <p className="text-sm text-amber-700">
              {formatRoleLabel(currentUserRole)} can edit encounter details but cannot mark
              encounters as completed.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !canEditEncounter}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
