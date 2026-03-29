"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_VISIT_TYPES, VISIT_LOCATIONS, type VisitLocation } from "./constants";
import { generateAvailableSlots, type BookedRange } from "./generateAvailableSlots";
import { cn } from "@/lib/utils";

export type VisitNavigatorOpenOptions = {
  defaultProviderId: string | null;
  visitType?: string;
  specialtyFilter?: string;
  isVirtual?: boolean;
};

type ProviderOption = {
  id: string;
  full_name: string | null;
  department: string | null;
  role: string | null;
};

const OUTPATIENT_DEPARTMENT_TYPES = [
  // Primary / general medicine
  "Primary Care",
  "Internal Medicine",
  "Family Medicine",
  "Pediatrics",
  "OB/GYN",
  "Geriatrics",
  "Palliative Care / Hospice",
  // Common outpatient specialties
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Neurology",
  "Psychiatry",
  "Pulmonology",
  "Rheumatology",
  "Infectious Disease",
  "Nephrology",
  "Hematology",
  "Medical Oncology",
  "Radiation Oncology",
  "Medical Genetics",
  "Physical Medicine & Rehabilitation",
  "Pain Medicine",
  "Sports Medicine",
  "Ophthalmology",
  "ENT",
  "Urology",
  // Procedure and surgery clinics (some orgs run outpatient consult/clinic flow here)
  "General Surgery",
  "Orthopedic Surgery",
  "Neurosurgery",
  "Vascular Surgery",
  "Plastic & Reconstructive Surgery",
  "Cardiothoracic Surgery",
  // Acute care options
  "EM",
  "Urgent Care",
] as const;

function mapDepartmentType(department: string | null | undefined): string | null {
  const raw = (department ?? "").toLowerCase();
  if (!raw) return null;
  if (raw.includes("primary care")) return "Primary Care";
  if (raw.includes("internal medicine") || raw.includes("(im)")) return "Internal Medicine";
  if (raw.includes("family medicine")) return "Family Medicine";
  if (raw.includes("pediatrics") || raw.includes("pediatric")) return "Pediatrics";
  if (raw.includes("obstetrics") || raw.includes("gynecology") || raw.includes("ob/gyn")) return "OB/GYN";
  if (raw.includes("geriatrics")) return "Geriatrics";
  if (raw.includes("palliative")) return "Palliative Care / Hospice";
  if (raw.includes("cardiology")) return "Cardiology";
  if (raw.includes("dermatology")) return "Dermatology";
  if (raw.includes("endocrinology")) return "Endocrinology";
  if (raw.includes("gastroenterology") || raw.includes("(gi)")) return "Gastroenterology";
  if (raw.includes("neurology")) return "Neurology";
  if (raw.includes("psychiatry")) return "Psychiatry";
  if (raw.includes("pulmonology")) return "Pulmonology";
  if (raw.includes("rheumatology")) return "Rheumatology";
  if (raw.includes("infectious disease")) return "Infectious Disease";
  if (raw.includes("nephrology")) return "Nephrology";
  if (raw.includes("hematology")) return "Hematology";
  if (raw.includes("medical oncology")) return "Medical Oncology";
  if (raw.includes("radiation oncology")) return "Radiation Oncology";
  if (raw.includes("medical genetics")) return "Medical Genetics";
  if (raw.includes("physical medicine") || raw.includes("pm&r") || raw.includes("physiatry")) {
    return "Physical Medicine & Rehabilitation";
  }
  if (raw.includes("pain medicine")) return "Pain Medicine";
  if (raw.includes("sports medicine")) return "Sports Medicine";
  if (raw.includes("ophthalmology")) return "Ophthalmology";
  if (raw.includes("otolaryngology") || raw.includes("ent")) return "ENT";
  if (raw.includes("urology")) return "Urology";
  if (raw.includes("general surgery")) return "General Surgery";
  if (raw.includes("orthopedic")) return "Orthopedic Surgery";
  if (raw.includes("neurosurgery")) return "Neurosurgery";
  if (raw.includes("vascular surgery")) return "Vascular Surgery";
  if (raw.includes("plastic") || raw.includes("reconstructive")) return "Plastic & Reconstructive Surgery";
  if (raw.includes("cardiothoracic")) return "Cardiothoracic Surgery";
  if (raw.includes("emergency medicine") || raw.includes("(em)")) return "EM";
  if (raw.includes("urgent care")) return "Urgent Care";
  return null;
}

const PRE_VISIT = [
  { id: "insurance", label: "I have confirmed my insurance information" },
  { id: "medications", label: "I have reviewed / updated my medication list" },
] as const;

type VisitNavigatorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  providers: ProviderOption[];
  initialOptions: VisitNavigatorOpenOptions | null;
};

export function VisitNavigatorModal({
  open,
  onOpenChange,
  patientId,
  providers,
  initialOptions,
}: VisitNavigatorModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<"schedule" | "confirm">("schedule");
  const [departmentType, setDepartmentType] = useState<string>("");
  const [providerId, setProviderId] = useState<string>("");
  const [location, setLocation] = useState<VisitLocation>(VISIT_LOCATIONS[0]);
  const [visitType, setVisitType] = useState<string>(DEFAULT_VISIT_TYPES[0]);
  const [booked, setBooked] = useState<BookedRange[]>([]);
  const [loadingBooked, setLoadingBooked] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVirtual, setIsVirtual] = useState(false);

  const rangeStart = useMemo(() => startOfDay(new Date()), []);
  const rangeEnd = useMemo(() => addDays(rangeStart, 6), [rangeStart]);
  const outpatientProviders = useMemo(
    () =>
      providers.filter((p) => {
        const mapped = mapDepartmentType(p.department);
        return mapped && OUTPATIENT_DEPARTMENT_TYPES.includes(mapped as (typeof OUTPATIENT_DEPARTMENT_TYPES)[number]);
      }),
    [providers]
  );
  const departmentTypeOptions = useMemo(
    () => [...OUTPATIENT_DEPARTMENT_TYPES],
    []
  );
  const filteredProviders = useMemo(
    () =>
      outpatientProviders.filter((p) => {
        if (!departmentType) return false;
        return mapDepartmentType(p.department) === departmentType;
      }),
    [outpatientProviders, departmentType]
  );

  useEffect(() => {
    if (!open) return;
    if (!initialOptions) {
      setStep("schedule");
      setSelectedSlot(null);
      setReason("");
      setNotes("");
      setChecklist({});
      setError(null);
      setIsVirtual(false);
      setVisitType(DEFAULT_VISIT_TYPES[0]);
      const defaultDept = departmentTypeOptions[0] ?? "";
      setDepartmentType(defaultDept);
      const firstProvider = outpatientProviders.find((p) => mapDepartmentType(p.department) === defaultDept);
      setProviderId(firstProvider?.id ?? "");
      return;
    }
    setStep("schedule");
    setSelectedSlot(null);
    setReason(initialOptions.specialtyFilter ? `Concern: ${initialOptions.specialtyFilter}` : "");
    setNotes("");
    setChecklist({});
    setError(null);
    setIsVirtual(Boolean(initialOptions.isVirtual));
    if (initialOptions.visitType) setVisitType(initialOptions.visitType);
    const initialProvider = outpatientProviders.find((p) => p.id === initialOptions.defaultProviderId) ?? null;
    const initialDept = initialProvider ? mapDepartmentType(initialProvider.department) : null;
    const chosenDept = initialDept ?? departmentTypeOptions[0] ?? "";
    setDepartmentType(chosenDept);
    const defaultProvider = initialProvider ?? outpatientProviders.find((p) => mapDepartmentType(p.department) === chosenDept) ?? null;
    setProviderId(defaultProvider?.id ?? "");
  }, [open, initialOptions, providers, departmentTypeOptions, outpatientProviders]);

  useEffect(() => {
    if (!open) return;
    if (!departmentType) {
      setProviderId("");
      return;
    }
    const hasCurrentProvider = filteredProviders.some((p) => p.id === providerId);
    if (!hasCurrentProvider) {
      setProviderId(filteredProviders[0]?.id ?? "");
      setSelectedSlot(null);
    }
  }, [open, departmentType, filteredProviders, providerId]);

  const loadBooked = useCallback(async () => {
    if (!providerId) {
      setBooked([]);
      return;
    }
    setLoadingBooked(true);
    const supabase = createClient();
    const { data, error: qErr } = await supabase
      .from("appointments")
      .select("slot_start, slot_end")
      .eq("provider_id", providerId)
      .gte("slot_start", rangeStart.toISOString())
      .lte("slot_start", rangeEnd.toISOString());
    setLoadingBooked(false);
    if (qErr) {
      setBooked([]);
      return;
    }
    setBooked((data || []) as BookedRange[]);
  }, [providerId, rangeStart, rangeEnd]);

  useEffect(() => {
    if (open) void loadBooked();
  }, [open, loadBooked]);

  const slotColumns = useMemo(
    () => generateAvailableSlots(rangeStart, rangeEnd, booked, { startHour: 9, endHour: 17, stepMinutes: 15 }),
    [rangeStart, rangeEnd, booked]
  );

  const canConfirm =
    PRE_VISIT.every((p) => checklist[p.id]) && reason.trim().length > 0 && selectedSlot && providerId;

  const handleSlotClick = (start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setStep("confirm");
  };

  const handleSubmit = async () => {
    if (!canConfirm || !selectedSlot) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    let resolvedPatientId = patientId;
    if (!resolvedPatientId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setSaving(false);
        setError("You must be signed in to book.");
        return;
      }
      const { data: linked } = await supabase
        .from("patients")
        .select("id, first_name, last_name, mrn")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (linked?.id) {
        resolvedPatientId = linked.id;
      } else {
        const nameFromMeta =
          typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
        const emailLocal = (user.email ?? "patient").split("@")[0];
        const parts = (nameFromMeta || emailLocal).split(/\s+/).filter(Boolean);
        const first = (parts[0] ?? "Patient").slice(0, 40);
        const last = (parts.slice(1).join(" ") || "Portal").slice(0, 40);
        const mrn = `PT-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`;
        const { data: created } = await supabase
          .from("patients")
          .insert({
            auth_user_id: user.id,
            first_name: first,
            last_name: last,
            dob: "2000-01-01",
            mrn,
          })
          .select("id")
          .maybeSingle();
        if (created?.id) {
          resolvedPatientId = created.id;
        } else {
          const { data: hydrated } = await supabase
            .from("patients")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          resolvedPatientId = hydrated?.id ?? null;
        }
      }
    }
    if (!resolvedPatientId) {
      setSaving(false);
      setError("Could not link patient profile for booking.");
      return;
    }
    const booking_meta = {
      pre_visit_checklist: checklist,
      specialty_hint: initialOptions?.specialtyFilter ?? null,
      visit_mode: isVirtual ? "virtual" : "in_person",
      patient_notes: notes.trim() || null,
      department_type: departmentType || null,
    };
    const { error: insErr } = await supabase.from("appointments").insert({
      patient_id: resolvedPatientId,
      provider_id: providerId,
      slot_start: selectedSlot.start.toISOString(),
      slot_end: selectedSlot.end.toISOString(),
      type: visitType,
      status: "scheduled",
      location,
      patient_reason: reason.trim(),
      booking_meta,
      is_virtual: isVirtual,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message || "Could not book appointment.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
      <Card className="relative w-full max-w-5xl max-h-[95vh] flex flex-col shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-slate-200 dark:border-border shrink-0">
          <div>
            <CardTitle className="text-lg">Visit Navigator</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {step === "schedule"
                ? "Select department type, provider, and location, then pick an available time."
                : "Confirm your visit details."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-y-auto flex-1 min-h-0 pt-4">
          {step === "schedule" && (
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
              <div className="w-full lg:w-[280px] shrink-0 space-y-3">
                <div>
                  <Label htmlFor="vn-department-type">Department type</Label>
                  <select
                    id="vn-department-type"
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm"
                    value={departmentType}
                    onChange={(e) => setDepartmentType(e.target.value)}
                  >
                    <option value="">Select department type</option>
                    {departmentTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="vn-provider">Provider</Label>
                  <select
                    id="vn-provider"
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm"
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                  >
                    <option value="">Select provider</option>
                    {filteredProviders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="vn-location">Location</Label>
                  <select
                    id="vn-location"
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm"
                    value={location}
                    onChange={(e) => setLocation(e.target.value as VisitLocation)}
                  >
                    {VISIT_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="vn-type">Visit type</Label>
                  <select
                    id="vn-type"
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm"
                    value={visitType}
                    onChange={(e) => setVisitType(e.target.value)}
                  >
                    {DEFAULT_VISIT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={isVirtual}
                    onCheckedChange={(v) => setIsVirtual(v === true)}
                  />
                  Virtual visit (video)
                </label>
                {loadingBooked && <p className="text-xs text-slate-500">Loading availability…</p>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                  Next 7 days (weekdays) · Available times (9:00 AM - 5:00 PM)
                </p>
                <div className="overflow-x-auto pb-2 -mx-1 px-1">
                  <div className="flex gap-3 min-w-[min(100%,720px)]">
                    {slotColumns.map((col) => (
                      <div
                        key={col.dateKey}
                        className="flex-1 min-w-[100px] rounded-lg border border-slate-200 dark:border-border bg-slate-50/80 dark:bg-muted/30 p-2"
                      >
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-foreground mb-2 text-center">
                          {col.label}
                        </p>
                        <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
                          {col.slots.map((s) => (
                            <button
                              key={s.start.toISOString()}
                              type="button"
                              disabled={!providerId || !departmentType}
                              onClick={() => handleSlotClick(s.start, s.end)}
                              className={cn(
                                "rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors",
                                "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-100",
                                "disabled:opacity-40 disabled:pointer-events-none"
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                          {col.slots.length === 0 && (
                            <p className="text-[11px] text-slate-500 text-center py-2">No slots</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {(!departmentType || !providerId) && (
                  <p className="text-xs text-amber-700 mt-2">Select a department type and provider to see open times.</p>
                )}
                {departmentType && filteredProviders.length === 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    No outpatient providers are currently available for this department type.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "confirm" && selectedSlot && (
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="rounded-lg border border-slate-200 dark:border-border p-3 text-sm space-y-1">
                <p>
                  <span className="text-slate-500">When: </span>
                  {format(selectedSlot.start, "EEEE, MMM d, yyyy 'at' h:mm a")}
                </p>
                <p>
                  <span className="text-slate-500">Department: </span>
                  {departmentType || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Provider: </span>
                  {providers.find((p) => p.id === providerId)?.full_name || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Location: </span>
                  {location}
                </p>
                <p>
                  <span className="text-slate-500">Visit type: </span>
                  {visitType}
                  {isVirtual && " · Virtual"}
                </p>
              </div>
              <div>
                <Label htmlFor="vn-reason">Reason for visit</Label>
                <Textarea
                  id="vn-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 min-h-[100px]"
                  placeholder="Describe symptoms, goals, or questions for your visit."
                  required
                />
              </div>
              <div>
                <Label htmlFor="vn-notes">Notes (optional)</Label>
                <Textarea
                  id="vn-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 min-h-[80px]"
                  placeholder="Anything else your care team should know (symptom timeline, preferences, questions)."
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pre-visit tasks</p>
                {PRE_VISIT.map((item) => (
                  <label key={item.id} className="flex items-start gap-3 text-sm cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={Boolean(checklist[item.id])}
                      onCheckedChange={(v) =>
                        setChecklist((prev) => ({ ...prev, [item.id]: v === true }))
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("schedule");
                    setSelectedSlot(null);
                  }}
                >
                  Back
                </Button>
                <Button type="button" onClick={() => void handleSubmit()} disabled={!canConfirm || saving}>
                  {saving ? "Confirming…" : "Confirm appointment"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
