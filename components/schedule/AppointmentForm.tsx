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

interface Provider {
  id: string;
  full_name: string | null;
}

interface AppointmentFormProps {
  patients: Patient[];
  providers: Provider[];
  defaultSlot?: { start: string; end: string } | null;
  providerId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentForm({
  patients,
  providers,
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
  const [status, setStatus] = useState("scheduled");
  const [assignedProviderId, setAssignedProviderId] = useState(providerId ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const full = `${p.last_name}, ${p.first_name}`.toLowerCase();
    const mrn = p.mrn.toLowerCase();
    return full.includes(q) || mrn.includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!patientId) return;
    if (new Date(slotEnd).getTime() <= new Date(slotStart).getTime()) {
      setErrorMsg("End time must be after start time.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("appointments").insert({
      patient_id: patientId,
      provider_id: assignedProviderId || null,
      slot_start: new Date(slotStart).toISOString(),
      slot_end: new Date(slotEnd).toISOString(),
      type,
      status,
    });
    setSaving(false);
    if (error) {
      setErrorMsg(error.message || "Could not create appointment.");
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
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient by name or MRN"
                className="mt-1 mb-2"
              />
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
                required
              >
                <option value="">Select patient</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name}, {p.first_name} (MRN: {p.mrn})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Provider</Label>
              <select
                value={assignedProviderId}
                onChange={(e) => setAssignedProviderId(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="">Unassigned</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || "Unnamed"}
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
            <div>
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}
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
