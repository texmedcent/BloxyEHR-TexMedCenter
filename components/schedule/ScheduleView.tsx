"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, User } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { AppointmentForm } from "./AppointmentForm";
import { CalendarView } from "./CalendarView";

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

interface Appointment {
  id: string;
  slot_start: string;
  slot_end: string;
  type: string | null;
  status: string;
  patient?: Patient | null;
  provider_name?: string | null;
}

interface ScheduleViewProps {
  appointments: Appointment[];
  patients: Patient[];
  providers: Provider[];
  currentDate: string;
  selectedProviderId: string | null;
  providerId?: string;
}

export function ScheduleView({
  appointments,
  patients,
  providers,
  currentDate,
  selectedProviderId,
  providerId,
}: ScheduleViewProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);

  const date = parseISO(currentDate);

  const goToDate = (d: Date) => {
    const params = new URLSearchParams({ date: format(d, "yyyy-MM-dd") });
    if (selectedProviderId) params.set("provider", selectedProviderId);
    router.push(`/schedule?${params}`);
  };

  const setProvider = (id: string | null) => {
    const params = new URLSearchParams({ date: currentDate });
    if (id && id !== "all") params.set("provider", id);
    router.push(`/schedule?${params}`);
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary shrink-0" />
          Scheduling
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">View and manage appointments by provider.</p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <label htmlFor="provider-select" className="text-sm font-medium text-muted-foreground flex items-center gap-2 shrink-0">
            <User className="h-4 w-4" />
            Provider
          </label>
          <select
            id="provider-select"
            value={selectedProviderId || "all"}
            onChange={(e) => setProvider(e.target.value === "all" ? null : e.target.value)}
            className="h-10 min-w-[200px] rounded-lg border border-input bg-background px-4 text-sm"
            aria-label="Select provider"
          >
            <option value="all">All Providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || "Unnamed"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => goToDate(subDays(date, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[180px] text-center text-base">
            {format(date, "EEEE, MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => goToDate(addDays(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="default" onClick={() => goToDate(new Date())}>
          Today
        </Button>
        <Button size="default" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
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
          providerId={selectedProviderId || providerId}
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
