"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CAMPUSES = ["Primary Care Office", "Emergency Room", "Urgent Care"] as const;

type ActiveCheckin = {
  id: string;
  campus: string;
  status: string;
  checked_in_at: string;
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

  const handleCheckIn = async () => {
    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("patient_checkins")
      .select("id, campus, status, checked_in_at")
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
      })
      .select("id, campus, status, checked_in_at")
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Check In</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeCheckin ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800">Current status: {activeCheckin.status.toUpperCase()}</p>
            <p className="text-amber-700">Campus: {activeCheckin.campus}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value as (typeof CAMPUSES)[number])}
              className="h-9 rounded border border-slate-300 bg-white px-3 text-sm"
              disabled={saving}
            >
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
