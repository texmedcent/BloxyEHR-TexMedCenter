"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface RecordRecentPatientProps {
  patientId: string;
}

export function RecordRecentPatient({ patientId }: RecordRecentPatientProps) {
  useEffect(() => {
    const record = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("recent_patients").upsert(
        {
          user_id: user.id,
          patient_id: patientId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,patient_id" }
      );
    };

    record();
  }, [patientId]);

  return null;
}
