"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { format } from "date-fns";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface AppointmentFormProps {
  patients: Patient[];
  defaultSlot?: { start: string; end: string } | null;
  providerId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentForm({
  patients,
  defaultSlot,
  providerId,
  onClose,
  onSaved,
}: AppointmentFormProps) {
  const [patientId, setPatientId] = useState("");
  const [slotStart, setSlotStart] = useState(
    defaultSlot?.start
      ? format(new Date(defaultSlot.start), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'09:00")
  );
  const [slotEnd, setSlotEnd] = useState(
    defaultSlot?.end
      ? format(new Date(defaultSlot.end), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'10:00")
  );
  const [type, setType] = useState("visit");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId,
      provider_id: providerId || null,
      slot_start: new Date(slotStart).toISOString(),
      slot_end: new Date(slotEnd).toISOString(),
      type,
      status: "scheduled",
    });
    setSaving(false);
    if (error) {
      console.error(error);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>New Appointment</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Patient</Label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
                required
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name}, {p.first_name} (MRN: {p.mrn})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Type</Label>
              <Input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. visit, follow-up"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Schedule"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
