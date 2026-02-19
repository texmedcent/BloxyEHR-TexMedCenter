"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { EncounterStatusPanel } from "./EncounterStatusPanel";

interface EncounterStatusModalProps {
  patientId: string;
  encounterId: string;
  onClose: () => void;
  onUpdated: () => void;
}

type EncounterRow = {
  id: string;
  status: string;
  workflow_status?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  assigned_at?: string | null;
  encounter_display_id?: string | null;
  last_updated_by_name?: string | null;
  last_updated_at?: string | null;
  supervising_attending?: string | null;
};

export function EncounterStatusModal({
  patientId,
  encounterId,
  onClose,
  onUpdated,
}: EncounterStatusModalProps) {
  const [encounter, setEncounter] = useState<EncounterRow | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string | null } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: e } = await supabase
        .from("encounters")
        .select("*")
        .eq("id", encounterId)
        .maybeSingle();
      setEncounter((e as EncounterRow | null) ?? null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle();
      setCurrentUser({
        id: user.id,
        name: profile?.full_name || user.email || "Clinician",
        role: profile?.role || null,
      });
    };
    void loadData();
  }, [encounterId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Encounter Status</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <EncounterStatusPanel
            patientId={patientId}
            encounter={encounter}
            currentUser={currentUser}
            onUpdated={() => {
              onUpdated();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
