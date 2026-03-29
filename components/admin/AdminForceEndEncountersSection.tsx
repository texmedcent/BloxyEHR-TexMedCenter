"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { isHospitalManager, resolveRoleWithBootstrap } from "@/lib/roles";

interface ActiveEncounter {
  id: string;
  patient_id: string;
  type: string;
  campus?: string | null;
  care_setting?: string | null;
  admit_date: string | null;
  assigned_to_name: string | null;
  patient_name?: string | null;
  mrn?: string | null;
}

interface AdminForceEndEncountersSectionProps {
  activeEncounters: ActiveEncounter[];
}

const TYPE_LABELS: Record<string, string> = {
  outpatient: "Outpatient",
  inpatient: "Inpatient",
  ed: "ED",
};

export function AdminForceEndEncountersSection({ activeEncounters }: AdminForceEndEncountersSectionProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const forceEnd = async (encounterId: string) => {
    if (busyId) return;
    setBusyId(encounterId);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("You are not signed in.");
      setBusyId(null);
      return;
    }
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle()
      : { data: null };
    const effectiveRole = resolveRoleWithBootstrap(user.email ?? null, profile?.role ?? null);
    if (effectiveRole === "hospital_manager" && !isHospitalManager(profile?.role)) {
      // Keep DB role aligned so trigger-level manager bypass can run.
      await supabase.from("profiles").update({ role: "hospital_manager" }).eq("id", user.id);
    }
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("encounters")
      .update({
        status: "completed",
        discharge_date: nowIso,
        workflow_status: "completed",
        disposition_type: "transfer",
        final_diagnosis_description: "Administratively closed by manager",
        discharge_instructions: "Administratively closed.",
        return_precautions: "N/A",
        last_updated_by: user?.id ?? null,
        last_updated_by_name: profile?.full_name ?? "Manager",
        last_updated_at: nowIso,
      })
      .eq("id", encounterId)
      .eq("status", "active");

    if (error) {
      setMessage(`Force End failed: ${error.message}`);
      setBusyId(null);
      return;
    }
    await supabase
      .from("patient_checkins")
      .update({ status: "completed" })
      .eq("encounter_id", encounterId)
      .in("status", ["triage", "in_encounter"]);
    setMessage("Encounter force-ended.");
    setBusyId(null);
    router.refresh();
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-foreground">
          <Stethoscope className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Force End Encounters
        </CardTitle>
        <CardDescription>
          Administratively close active encounters. Use when an encounter must be ended without completing normal workflows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message ? (
          <div className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</div>
        ) : null}
        {activeEncounters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active encounters.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activeEncounters.map((enc) => (
              <div
                key={enc.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{enc.patient_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {enc.campus || TYPE_LABELS[enc.type] || enc.type}
                    {enc.care_setting ? ` (${enc.care_setting})` : ""}
                    {enc.admit_date && ` · Admitted ${format(new Date(enc.admit_date), "MMM d, h:mm a")}`}
                    {enc.assigned_to_name && ` · ${enc.assigned_to_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/chart/${enc.patient_id}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId === enc.id}
                    onClick={() => forceEnd(enc.id)}
                  >
                    {busyId === enc.id ? "Ending..." : "Force End"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
