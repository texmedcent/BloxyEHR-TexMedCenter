"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";

const CAMPUSES = ["Primary Care Office", "Emergency Room", "Urgent Care"] as const;
const ACUITY_LEVELS = ["esi_1", "esi_2", "esi_3", "esi_4", "esi_5"] as const;
const ARRIVAL_MODES = ["walk_in", "ambulance", "transfer", "police", "other"] as const;

type ActiveCheckin = {
  id: string;
  campus: string;
  status: string;
  checked_in_at: string;
  chief_complaint: string | null;
  acuity_level: string | null;
  pain_score: number | null;
  arrival_mode: string | null;
} | null;

export function CheckInCard({
  userId,
  fullName,
  email,
  initialActiveCheckin,
}: {
  userId: string;
  fullName: string | null;
  email: string | null | undefined;
  initialActiveCheckin: ActiveCheckin;
}) {
  const [campus, setCampus] = useState<(typeof CAMPUSES)[number]>("Primary Care Office");
  const [activeCheckin, setActiveCheckin] = useState<ActiveCheckin>(initialActiveCheckin);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [acuityLevel, setAcuityLevel] = useState<(typeof ACUITY_LEVELS)[number]>("esi_3");
  const [painScore, setPainScore] = useState("0");
  const [arrivalMode, setArrivalMode] = useState<(typeof ARRIVAL_MODES)[number]>("walk_in");

  const handleCheckIn = async () => {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("patient_checkins")
      .select("id, campus, status, checked_in_at, chief_complaint, acuity_level, pain_score, arrival_mode")
      .eq("auth_user_id", userId)
      .in("status", ["triage", "in_encounter"])
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setActiveCheckin(existing);
      setMessage("You are already checked in.");
      setSaving(false);
      return;
    }

    let patientId: string | null = null;
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (existingPatient?.id) {
      patientId = existingPatient.id;
    } else {
      const name = (fullName || (email ? email.split("@")[0] : "Patient")).trim();
      const [first, ...rest] = name.split(" ");
      const last = rest.join(" ") || "Patient";
      const mrn = `PT${Date.now().toString().slice(-8)}`;
      const { data: createdPatient, error: createPatientError } = await supabase
        .from("patients")
        .insert({
          auth_user_id: userId,
          mrn,
          first_name: first || "Patient",
          last_name: last,
          dob: "2000-01-01",
          contact_info: { email: email || null },
        })
        .select("id")
        .single();

      if (createPatientError || !createdPatient) {
        setMessage(createPatientError?.message || "Unable to create patient profile.");
        setSaving(false);
        return;
      }
      patientId = createdPatient.id;
    }

    const { data: checkin, error } = await supabase
      .from("patient_checkins")
      .insert({
        auth_user_id: userId,
        patient_id: patientId,
        campus,
        status: "triage",
        chief_complaint: chiefComplaint.trim() || null,
        acuity_level: acuityLevel,
        pain_score: Number.isNaN(Number(painScore)) ? null : Number(painScore),
        arrival_mode: arrivalMode,
      })
      .select("id, campus, status, checked_in_at, chief_complaint, acuity_level, pain_score, arrival_mode")
      .single();

    setSaving(false);
    if (error || !checkin) {
      setMessage(error?.message || "Unable to check in right now.");
      return;
    }

    setActiveCheckin(checkin);
    setMessage("Checked in successfully. You are now in TRIAGE queue.");
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-foreground">
          <ClipboardCheck className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
          Check In
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCheckin ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3 text-sm">
            <p className="font-medium text-amber-800">Current status: {activeCheckin.status.toUpperCase()}</p>
            <p className="text-amber-700">Campus: {activeCheckin.campus}</p>
            {activeCheckin.chief_complaint && (
              <p className="text-amber-700">Chief complaint: {activeCheckin.chief_complaint}</p>
            )}
            <p className="text-amber-700">
              Acuity: {(activeCheckin.acuity_level || "not_set").replaceAll("_", " ").toUpperCase()}
              {activeCheckin.pain_score !== null ? ` · Pain ${activeCheckin.pain_score}/10` : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-slate-500">Campus</p>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value as (typeof CAMPUSES)[number])}
                  className="h-9 w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  disabled={saving}
                >
                  {CAMPUSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Arrival Mode</p>
                <select
                  value={arrivalMode}
                  onChange={(e) => setArrivalMode(e.target.value as (typeof ARRIVAL_MODES)[number])}
                  className="h-9 w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  disabled={saving}
                >
                  {ARRIVAL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Acuity</p>
                <select
                  value={acuityLevel}
                  onChange={(e) => setAcuityLevel(e.target.value as (typeof ACUITY_LEVELS)[number])}
                  className="h-9 w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  disabled={saving}
                >
                  {ACUITY_LEVELS.map((acuity) => (
                    <option key={acuity} value={acuity}>
                      {acuity.replaceAll("_", " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Pain Score (0-10)</p>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={painScore}
                  onChange={(e) => setPainScore(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  disabled={saving}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Chief Complaint</p>
              <input
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                placeholder="Reason for visit"
                disabled={saving}
              />
            </div>
            <Button onClick={handleCheckIn} disabled={saving}>
              {saving ? "Checking In..." : "Check In"}
            </Button>
          </div>
        )}

        {message && <p className="text-xs text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}
