"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { AppointmentForm } from "./AppointmentForm";
import { CalendarView } from "./CalendarView";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface Appointment {
  id: string;
  slot_start: string;
  slot_end: string;
  type: string | null;
  status: string;
  patient?: Patient | null;
}

interface ScheduleViewProps {
  appointments: Appointment[];
  patients: Patient[];
  currentDate: string;
  providerId?: string;
}

export function ScheduleView({
  appointments,
  patients,
  currentDate,
  providerId,
}: ScheduleViewProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const date = parseISO(currentDate);

  const goToDate = (d: Date) => {
    router.push(`/schedule?date=${format(d, "yyyy-MM-dd")}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Scheduling</h1>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToDate(subDays(date, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[140px] text-center">
            {format(date, "EEEE, MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToDate(addDays(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => goToDate(new Date())}>
          Today
        </Button>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Appointment
        </Button>
      </div>

      <CalendarView
        appointments={appointments}
        currentDate={currentDate}
        onSlotClick={(start, end) => {
          setSelectedSlot({ start, end });
          setShowForm(true);
        }}
      />

      {showForm && (
        <AppointmentForm
          patients={patients}
          defaultSlot={selectedSlot}
          providerId={providerId}
          onClose={() => {
            setShowForm(false);
            setSelectedSlot(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setSelectedSlot(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
