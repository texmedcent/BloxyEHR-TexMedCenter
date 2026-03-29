"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, Plus, Search, User } from "lucide-react";
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
  provider_id?: string | null;
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
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "completed" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "agenda">("day");

  const date = parseISO(currentDate);

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments
      .filter((a) => (statusFilter === "all" ? true : (a.status || "").toLowerCase() === statusFilter))
      .filter((a) => {
        if (!q) return true;
        const patientName = a.patient ? `${a.patient.last_name}, ${a.patient.first_name}`.toLowerCase() : "";
        const mrn = a.patient?.mrn?.toLowerCase() ?? "";
        const providerName = (a.provider_name || "").toLowerCase();
        const type = (a.type || "").toLowerCase();
        return patientName.includes(q) || mrn.includes(q) || providerName.includes(q) || type.includes(q);
      })
      .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
  }, [appointments, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const scheduled = appointments.filter((a) => (a.status || "").toLowerCase() === "scheduled").length;
    const completed = appointments.filter((a) => (a.status || "").toLowerCase() === "completed").length;
    const cancelled = appointments.filter((a) => (a.status || "").toLowerCase() === "cancelled").length;
    return { total, scheduled, completed, cancelled };
  }, [appointments]);

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
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary shrink-0" />
          Scheduling
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Fast daily scheduling with provider filters, search, and an agenda view.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Scheduled</p>
          <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{stats.scheduled}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-xl font-semibold">{stats.completed}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Cancelled</p>
          <p className="text-xl font-semibold">{stats.cancelled}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
        <div className="flex flex-wrap items-center gap-3">
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, MRN, type, provider"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("day")}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Day
            </Button>
            <Button
              variant={viewMode === "agenda" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("agenda")}
            >
              <List className="mr-2 h-4 w-4" />
              Agenda
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goToDate(subDays(date, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[220px] text-center text-base">
              {format(date, "EEEE, MMM d, yyyy")}
            </span>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => goToDate(addDays(date, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => goToDate(new Date())}>
            Today
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
          <p className="ml-auto text-xs text-muted-foreground">{filteredAppointments.length} matching appointments</p>
        </div>
      </div>

      {viewMode === "day" ? (
        <CalendarView
          appointments={filteredAppointments}
          currentDate={currentDate}
          onSlotClick={(start, end) => {
            setSelectedSlot({ start, end });
            setShowForm(true);
          }}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-border dark:bg-card">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              Agenda View
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {filteredAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments match current filters.</p>
            ) : (
              filteredAppointments.map((appt) => {
                const patientLabel = appt.patient
                  ? `${appt.patient.last_name}, ${appt.patient.first_name}`
                  : "Unknown patient";
                return (
                  <div key={appt.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-border">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{patientLabel}</p>
                      <span className="text-xs uppercase text-muted-foreground">{appt.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(appt.slot_start), "h:mm a")} - {format(new Date(appt.slot_end), "h:mm a")}
                      {appt.type ? ` · ${appt.type}` : ""}
                    </p>
                    {appt.provider_name ? (
                      <p className="text-xs text-muted-foreground">Provider: {appt.provider_name}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showForm && (
        <AppointmentForm
          patients={patients}
          providers={providers}
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
