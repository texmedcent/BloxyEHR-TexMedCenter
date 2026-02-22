"use client";

import Link from "next/link";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface AppointmentSlotProps {
  appointment: {
    id: string;
    slot_start: string;
    slot_end: string;
    type: string | null;
    status: string;
    patient?: Patient | null;
    provider_name?: string | null;
  };
}

export function AppointmentSlot({ appointment }: AppointmentSlotProps) {
  const patientName = appointment.patient
    ? `${appointment.patient.last_name}, ${appointment.patient.first_name}`
    : "Unknown";

  return (
    <Link
      href={`/chart/${appointment.patient?.id || ""}`}
      className="px-4 py-2.5 rounded-lg border border-atrium-primary/30 bg-atrium-primary/10 text-sm hover:bg-atrium-primary/20 transition-colors block"
      aria-label={`Appointment: ${patientName}${appointment.type ? `, ${appointment.type}` : ""}`}
    >
      <span className="font-medium">{patientName}</span>
      {appointment.type && (
        <span className="text-muted-foreground ml-2">({appointment.type})</span>
      )}
      {appointment.provider_name && (
        <span className="block text-xs text-muted-foreground mt-0.5">{appointment.provider_name}</span>
      )}
    </Link>
  );
}
