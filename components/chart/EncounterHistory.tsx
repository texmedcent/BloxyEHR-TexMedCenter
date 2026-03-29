"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { EncounterStatusModal } from "./EncounterStatusModal";
import { EncounterEditModal } from "./EncounterEditModal";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";
import {
  FALLBACK_CAMPUSES,
  normalizeCareSetting,
  careSettingToEncounterType,
  type CampusOption,
  type CareSetting,
} from "@/lib/campuses";

interface Encounter {
  id: string;
  type: string;
  campus?: string | null;
  care_setting?: string | null;
  admit_date: string | null;
  discharge_date: string | null;
  status: string;
  final_diagnosis_code?: string | null;
  final_diagnosis_description?: string | null;
}

interface EncounterHistoryProps {
  patientId: string;
  encounters: Encounter[];
  currentUserRole: string | null;
}

export function EncounterHistory({
  patientId,
  encounters,
  currentUserRole,
}: EncounterHistoryProps) {
  const router = useRouter();
  const [endingId, setEndingId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [endEncounterError, setEndEncounterError] = useState<string | null>(null);
  const [collectingTriage, setCollectingTriage] = useState(false);
  const [quickTriageNote, setQuickTriageNote] = useState("");
  const [campuses, setCampuses] = useState<CampusOption[]>(FALLBACK_CAMPUSES);
  const [campus, setCampus] = useState<string>(FALLBACK_CAMPUSES[0]?.name || "Primary Care Office");
  const [careSetting, setCareSetting] = useState<CareSetting>("outpatient");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    encounterId: string;
  } | null>(null);
  const [statusEncounterId, setStatusEncounterId] = useState<string | null>(null);
  const [editEncounterId, setEditEncounterId] = useState<string | null>(null);
  const canStartEncounter = hasRolePermission(currentUserRole, "start_encounter");
  const canEditEncounter = hasRolePermission(currentUserRole, "edit_encounter");
  const canFinalizeEncounter = hasRolePermission(currentUserRole, "finalize_encounter");

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("institution_campuses")
        .select("id, name, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        setCampuses(data);
        setCampus((current) => (data.some((campusRow) => campusRow.name === current) ? current : data[0].name));
      }
    })();
  }, []);

  const endEncounter = async (encounterId: string) => {
    if (!canFinalizeEncounter) return;
    setEndingId(encounterId);
    setEndEncounterError(null);
    const supabase = createClient();

    const nowIso = new Date().toISOString();

    const { error: encounterError } = await supabase
      .from("encounters")
      .update({
        status: "completed",
        discharge_date: nowIso,
      })
      .eq("id", encounterId)
      .in("status", ["active", "in_progress"]);

    if (encounterError) {
      setEndingId(null);
      setEndEncounterError(encounterError.message);
      return;
    }

    // Close any linked active check-in for this encounter.
    await supabase
      .from("patient_checkins")
      .update({ status: "completed" })
      .eq("encounter_id", encounterId)
      .in("status", ["triage", "in_encounter"]);

    setEndingId(null);
    router.refresh();
  };

  const startNewEncounter = async () => {
    if (!canStartEncounter) return;
    const triageNote = quickTriageNote.trim();
    if (!triageNote) {
      setEndEncounterError("Add quick triage notes before starting a new encounter.");
      return;
    }
    setStarting(true);
    setEndEncounterError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const normalizedCareSetting = normalizeCareSetting(careSetting);
    const encounterType = careSettingToEncounterType(normalizedCareSetting);

    const { data: encounter, error } = await supabase
      .from("encounters")
      .insert({
        patient_id: patientId,
        type: encounterType,
        campus,
        care_setting: normalizedCareSetting,
        admit_date: new Date().toISOString(),
        status: "active",
      })
      .select("id")
      .single();

    if (error || !encounter) {
      setStarting(false);
      setEndEncounterError(error?.message || "Unable to start encounter.");
      return;
    }

    // If patient is in triage queue, link latest triage check-in to this encounter.
    const { data: latestTriage } = await supabase
      .from("patient_checkins")
      .select("id, chief_complaint")
      .eq("patient_id", patientId)
      .eq("status", "triage")
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTriage?.id) {
      await supabase
        .from("patient_checkins")
        .update({
          status: "in_encounter",
          triaged_at: new Date().toISOString(),
          triaged_by: user?.id ?? null,
          encounter_id: encounter.id,
          chief_complaint: triageNote,
        })
        .eq("id", latestTriage.id);
    } else {
      await supabase.from("encounter_audit_log").insert({
        encounter_id: encounter.id,
        action: "quick_triage_note",
        field_changes: { quick_triage_note: triageNote },
        created_by: user?.id ?? null,
        created_by_name: user?.email ?? "Clinician",
      });
    }

    setStarting(false);
    setQuickTriageNote("");
    setCollectingTriage(false);
    router.refresh();
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-500 dark:text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          Encounter History
        </CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={careSetting}
            onChange={(e) => setCareSetting(normalizeCareSetting(e.target.value))}
            className="h-8 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
          >
            <option value="outpatient">Outpatient</option>
            <option value="inpatient">Inpatient</option>
          </select>
          {!collectingTriage ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                setCollectingTriage(true);
                setEndEncounterError(null);
              }}
              disabled={!canStartEncounter}
              title={
                !canStartEncounter
                  ? `Role ${formatRoleLabel(currentUserRole)} cannot start encounters`
                  : undefined
              }
            >
              New Chart
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {collectingTriage && (
          <div className="mb-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Quick triage notes</p>
            <Textarea
              value={quickTriageNote}
              onChange={(e) => setQuickTriageNote(e.target.value)}
              placeholder="Brief intake note for this new chart (chief complaint, key symptoms, context)."
              className="min-h-[72px] bg-white dark:bg-background"
            />
            <div className="flex items-center gap-2">
              {quickTriageNote.trim().length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={startNewEncounter}
                  disabled={starting || !canStartEncounter}
                >
                  {starting ? "Starting..." : "Start Encounter"}
                </Button>
              ) : (
                <p className="text-xs text-amber-800 dark:text-amber-200">Enter notes to enable Start Encounter.</p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setCollectingTriage(false);
                  setQuickTriageNote("");
                  setEndEncounterError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {endEncounterError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            Encounter update failed: {endEncounterError}
          </div>
        )}
        {encounters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-muted-foreground mb-3">No encounters yet.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCollectingTriage(true);
                setEndEncounterError(null);
              }}
              disabled={!canStartEncounter}
            >
              New Chart
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {encounters.map((e) => (
              <li key={e.id}>
                <div
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-border p-3 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      encounterId: e.id,
                    });
                  }}
                >
                  <Link
                    href={`/documentation?patientId=${patientId}&encounterId=${e.id}`}
                    className="min-w-0 flex-1 hover:text-primary"
                  >
                    <span className="font-medium">{e.campus || "Unknown campus"}</span>
                    <span className="ml-2 text-xs text-slate-500 dark:text-muted-foreground">
                      {normalizeCareSetting(e.care_setting || e.type).replaceAll("_", " ")}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-muted-foreground ml-2">
                      {e.admit_date
                        ? format(new Date(e.admit_date), "MM/dd/yyyy")
                        : "—"}
                      {e.discharge_date && (
                        <> – {format(new Date(e.discharge_date), "MM/dd/yyyy")}</>
                      )}
                    </span>
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        ["active", "in_progress"].includes((e.status || "").toLowerCase())
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                          : "bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground"
                      }`}
                    >
                      {e.status}
                    </span>
                    {e.status === "completed" &&
                      (e.final_diagnosis_code || e.final_diagnosis_description) && (
                        <span className="ml-2 text-xs text-slate-700">
                          Dx: {e.final_diagnosis_code || ""}{" "}
                          {e.final_diagnosis_description || ""}
                        </span>
                      )}
                  </Link>
                  {["active", "in_progress"].includes((e.status || "").toLowerCase()) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => endEncounter(e.id)}
                      disabled={endingId === e.id || !canFinalizeEncounter}
                      title={
                        !canFinalizeEncounter
                          ? `Role ${formatRoleLabel(
                              currentUserRole
                            )} cannot finalize encounters`
                          : undefined
                      }
                    >
                      {endingId === e.id ? "Ending..." : "End Encounter"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {contextMenu && (
        <div
          className="fixed z-50 w-44 rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card p-1 shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-900 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted/50"
            onClick={() => {
              setStatusEncounterId(contextMenu.encounterId);
              setContextMenu(null);
            }}
          >
            Encounter Status
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-900 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted/50 disabled:text-slate-400 dark:disabled:text-muted-foreground"
            onClick={() => {
              if (!canEditEncounter) return;
              setEditEncounterId(contextMenu.encounterId);
              setContextMenu(null);
            }}
            disabled={!canEditEncounter}
          >
            {canEditEncounter ? "Edit" : `Edit (Restricted)`}
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-900 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted/50"
            onClick={() => {
              router.push(`/documentation?patientId=${patientId}&encounterId=${contextMenu.encounterId}`);
              setContextMenu(null);
            }}
          >
            View
          </button>
        </div>
      )}
      {statusEncounterId && (
        <EncounterStatusModal
          patientId={patientId}
          encounterId={statusEncounterId}
          onClose={() => setStatusEncounterId(null)}
          onUpdated={() => router.refresh()}
        />
      )}
      {editEncounterId && (
        <EncounterEditModal
          encounterId={editEncounterId}
          patientId={patientId}
          currentUserRole={currentUserRole}
          onClose={() => setEditEncounterId(null)}
          onSaved={() => {
            setEditEncounterId(null);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}
