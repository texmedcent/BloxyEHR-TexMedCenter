"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface ClaimPatientButtonProps {
  patientId: string;
  userId: string;
  initiallyClaimed: boolean;
}

export function ClaimPatientButton({
  patientId,
  userId,
  initiallyClaimed,
}: ClaimPatientButtonProps) {
  const [claimed, setClaimed] = useState(initiallyClaimed);
  const [saving, setSaving] = useState(false);

  const toggleClaim = async () => {
    setSaving(true);
    const supabase = createClient();

    if (claimed) {
      await supabase
        .from("recent_patients")
        .upsert(
          {
            user_id: userId,
            patient_id: patientId,
            is_pinned: false,
            viewed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,patient_id" }
        );
      setClaimed(false);
    } else {
      await supabase
        .from("recent_patients")
        .upsert(
          {
            user_id: userId,
            patient_id: patientId,
            is_pinned: true,
            viewed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,patient_id" }
        );
      setClaimed(true);
    }

    setSaving(false);
  };

  return (
    <Button
      size="sm"
      variant={claimed ? "default" : "outline"}
      className={claimed ? "bg-[#1a4d8c] hover:bg-[#1a4d8c]/90" : ""}
      onClick={toggleClaim}
      disabled={saving}
    >
      <Star className={`mr-1 h-4 w-4 ${claimed ? "fill-white" : ""}`} />
      {claimed ? "Claimed" : "Claim Chart"}
    </Button>
  );
}
