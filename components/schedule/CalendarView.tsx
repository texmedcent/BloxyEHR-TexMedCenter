"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentSlot } from "./AppointmentSlot";
import { parseISO } from "date-fns";

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
  provider_name?: string | null;
}

interface CalendarViewProps {
  appointments: Appointment[];
  currentDate: string;
  onSlotClick: (start: string, end: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

export function CalendarView({
  appointments,
  currentDate,
  onSlotClick,
}: CalendarViewProps) {
  const date = parseISO(currentDate);

  const getAppointmentsForHour = (hour: number) => {
    const hourStart = new Date(date);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(date);
    hourEnd.setHours(hour, 59, 59, 999);
    return appointments.filter((a) => {
      const start = new Date(a.slot_start);
      return start >= hourStart && start <= hourEnd;
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Day View
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-hidden">
          {HOURS.map((hour) => {
            const slotApps = getAppointmentsForHour(hour);
            return (
              <div
                key={hour}
                className="flex border-b border-border last:border-b-0 min-h-[80px] bg-card"
              >
                <div
                  className="w-24 shrink-0 py-3 px-4 text-sm text-muted-foreground border-r border-border"
                  aria-label={`${hour}:00 time slot`}
                >
                  {hour}:00
                </div>
                <div className="flex-1 py-3 px-4 flex flex-wrap gap-3">
                  {slotApps.map((a) => (
                    <AppointmentSlot key={a.id} appointment={a} />
                  ))}
                  {slotApps.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const start = new Date(date);
                        start.setHours(hour, 0, 0, 0);
                        const end = new Date(date);
                        end.setHours(hour + 1, 0, 0, 0);
                        onSlotClick(start.toISOString(), end.toISOString());
                      }}
                      className="text-sm text-muted-foreground hover:text-primary rounded-lg px-3 py-2 hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`Add appointment at ${hour}:00`}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
