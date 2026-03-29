"use client";

import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Appt = { id: string; slot_start: string; type: string | null };

export function PatientMiniCalendar({ appointments }: { appointments: Appt[] }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-primary" />
          Calendar preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((d) => {
            const hasAppt = appointments.some((a) => isSameDay(new Date(a.slot_start), d));
            return (
              <div
                key={d.toISOString()}
                className="rounded-md border border-slate-200 dark:border-border bg-slate-50/80 dark:bg-muted/40 py-2 px-0.5"
              >
                <p className="text-[10px] uppercase text-slate-500">{format(d, "EEE")}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-foreground">{format(d, "d")}</p>
                <div className="mt-1 flex justify-center">
                  <span
                    className={`h-2 w-2 rounded-full ${hasAppt ? "bg-primary" : "bg-slate-200 dark:bg-slate-600"}`}
                    title={hasAppt ? "Has appointment" : "No appointment"}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Dots show days with a scheduled visit.</p>
      </CardContent>
    </Card>
  );
}
