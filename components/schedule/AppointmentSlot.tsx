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
  };
}

export function AppointmentSlot({ appointment }: AppointmentSlotProps) {
  const patientName = appointment.patient
    ? `${appointment.patient.last_name}, ${appointment.patient.first_name}`
    : "Unknown";

  return (
    <Link
      href={`/chart/${appointment.patient?.id || ""}`}
      className="px-3 py-1.5 rounded bg-[#1a4d8c]/10 text-sm hover:bg-[#1a4d8c]/20 transition-colors block"
      aria-label={`Appointment: ${patientName}${appointment.type ? `, ${appointment.type}` : ""}`}
    >
      <span className="font-medium">{patientName}</span>
      {appointment.type && (
        <span className="text-gray-600 ml-2">({appointment.type})</span>
      )}
    </Link>
  );
}
