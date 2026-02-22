"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, FlaskConical, Image, Pill, Stethoscope, X } from "lucide-react";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";
import { MedicationPickerModal } from "@/components/orders/MedicationPickerModal";
import { MEDICATION_FORMULARY } from "@/lib/medications";

interface OrderFormProps {
  patientId: string;
  currentUserRole: string | null;
  selectedEncounterId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const ORDER_TYPES = ["lab", "med", "imaging", "procedure"] as const;
const PRIORITY_OPTIONS = ["Routine", "Urgent", "STAT"] as const;
const ROUTE_DEFAULT_FREQUENCY: Record<string, string> = {
  PO: "BID",
  IV: "Q6H",
  IM: "Once",
  Neb: "Q4H PRN",
};

const MED_CLASS_KEYWORDS: Record<string, string[]> = {
  antibiotic: ["cillin", "cef", "mycin", "floxacin"],
  opioid: ["morphine", "hydrocodone", "oxycodone", "fentanyl"],
  anticoagulant: ["heparin", "enoxaparin", "warfarin", "apixaban"],
};

const MAX_DAILY_DOSE_MG: Record<string, number> = {
  Acetaminophen: 4000,
  Ibuprofen: 3200,
  Ketorolac: 120,
  Morphine: 200,
  Hydromorphone: 32,
  Oxycodone: 80,
  "Hydrocodone/Acetaminophen": 60,
  Fentanyl: 1.2,
  Lorazepam: 10,
};

const ED_PROTOCOL_ORDER_SETS: Record<
  string,
  { type: "lab" | "imaging" | "med" | "procedure"; details: Record<string, string> }[]
> = {
  chest_pain: [
    { type: "lab", details: { test: "Troponin", priority: "STAT" } },
    { type: "lab", details: { test: "CBC", priority: "STAT" } },
    { type: "imaging", details: { study: "Chest X-ray", priority: "STAT" } },
  ],
  abdominal_pain: [
    { type: "lab", details: { test: "CMP", priority: "STAT" } },
    { type: "lab", details: { test: "Lipase", priority: "STAT" } },
    { type: "imaging", details: { study: "CT Abdomen/Pelvis", priority: "urgent" } },
  ],
  trauma: [
    { type: "lab", details: { test: "Type and Screen", priority: "STAT" } },
    { type: "imaging", details: { study: "FAST Ultrasound", priority: "STAT" } },
    { type: "imaging", details: { study: "CT Head", priority: "STAT" } },
  ],
  sepsis: [
    { type: "lab", details: { test: "Lactate", priority: "STAT" } },
    { type: "lab", details: { test: "Blood Cultures x2", priority: "STAT" } },
    { type: "med", details: { note: "Broad-spectrum antibiotics per sepsis protocol" } },
  ],
};

export function OrderForm({
  patientId,
  currentUserRole,
  selectedEncounterId,
  onClose,
  onSaved,
}: OrderFormProps) {
  const [type, setType] = useState<"med" | "lab" | "imaging" | "procedure">("lab");
  const [details, setDetails] = useState("");
  const [labTest, setLabTest] = useState("");
  const [labPriority, setLabPriority] = useState<string>("Routine");
  const [imagingStudy, setImagingStudy] = useState("");
  const [imagingPriority, setImagingPriority] = useState<string>("Routine");
  const [procedureNote, setProcedureNote] = useState("");
  const [medication, setMedication] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [indication, setIndication] = useState("");
  const [controlledCode, setControlledCode] = useState("");
  const [showMedicationPicker, setShowMedicationPicker] = useState(false);
  const [allergyList, setAllergyList] = useState<string[]>([]);
  const [activeMedicationNames, setActiveMedicationNames] = useState<string[]>([]);
  const [holdReason, setHoldReason] = useState("");
  const [protocolSet, setProtocolSet] = useState("");
  const [renalRisk, setRenalRisk] = useState(false);
  const [hepaticRisk, setHepaticRisk] = useState(false);
  const [pregnancyStatus, setPregnancyStatus] = useState<"not_pregnant" | "pregnant" | "unknown">("unknown");
  const [lactationStatus, setLactationStatus] = useState<"not_lactating" | "lactating" | "unknown">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canPlaceOrders = hasRolePermission(currentUserRole, "place_order");
  const selectedMedicationOption = useMemo(
    () => MEDICATION_FORMULARY.find((option) => option.name === medication) || null,
    [medication]
  );
  const isControlledSubstance = selectedMedicationOption?.controlled ?? false;

  useEffect(() => {
    const loadAllergies = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("allergies, renal_risk, hepatic_risk, pregnancy_status, lactation_status")
        .eq("id", patientId)
        .maybeSingle();

      const parsed = Array.isArray(data?.allergies)
        ? (data?.allergies as { allergen?: string }[])
            .map((a) => a?.allergen?.trim())
            .filter((x): x is string => Boolean(x))
        : [];

      setAllergyList(parsed);
      setRenalRisk(Boolean(data?.renal_risk));
      setHepaticRisk(Boolean(data?.hepatic_risk));
      setPregnancyStatus(
        data?.pregnancy_status === "pregnant" || data?.pregnancy_status === "not_pregnant"
          ? data.pregnancy_status
          : "unknown"
      );
      setLactationStatus(
        data?.lactation_status === "lactating" || data?.lactation_status === "not_lactating"
          ? data.lactation_status
          : "unknown"
      );

      const { data: activeMedOrders } = await supabase
        .from("orders")
        .select("details")
        .eq("patient_id", patientId)
        .eq("type", "med")
        .neq("status", "discontinued")
        .limit(30);
      const activeMeds = (activeMedOrders || [])
        .map((row) => {
          const record =
            row.details && typeof row.details === "object" && !Array.isArray(row.details)
              ? (row.details as Record<string, unknown>)
              : null;
          const name = typeof record?.medication === "string" ? record.medication.trim() : "";
          return name;
        })
        .filter(Boolean);
      setActiveMedicationNames(activeMeds);
    };

    void loadAllergies();
  }, [patientId]);

  const possibleAllergyConflict = useMemo(() => {
    if (type !== "med" || !medication.trim()) return null;
    const med = medication.toLowerCase();
    return allergyList.find((a) => med.includes(a.toLowerCase())) ?? null;
  }, [type, medication, allergyList]);

  const duplicateClassWarning = useMemo(() => {
    if (type !== "med" || !medication.trim()) return null;
    const med = medication.toLowerCase();
    const currentClass = Object.entries(MED_CLASS_KEYWORDS).find(([, keywords]) =>
      keywords.some((keyword) => med.includes(keyword))
    )?.[0];
    if (!currentClass) return null;
    const duplicates = activeMedicationNames.filter((existing) => {
      const lowerExisting = existing.toLowerCase();
      return MED_CLASS_KEYWORDS[currentClass].some((keyword) => lowerExisting.includes(keyword));
    });
    if (duplicates.length === 0) return null;
    return { className: currentClass, duplicates };
  }, [type, medication, activeMedicationNames]);

  const estimatedDailyDoseMg = useMemo(() => {
    if (type !== "med") return null;
    const doseMatch = dose.match(/(\d+(\.\d+)?)/);
    if (!doseMatch) return null;
    const doseMg = Number(doseMatch[1]);
    if (Number.isNaN(doseMg) || doseMg <= 0) return null;
    const freqUpper = frequency.trim().toUpperCase();
    let dosesPerDay = 1;
    if (freqUpper.includes("Q4")) dosesPerDay = 6;
    else if (freqUpper.includes("Q6")) dosesPerDay = 4;
    else if (freqUpper.includes("Q8")) dosesPerDay = 3;
    else if (freqUpper.includes("Q12") || freqUpper.includes("BID")) dosesPerDay = 2;
    else if (freqUpper.includes("TID")) dosesPerDay = 3;
    else if (freqUpper.includes("QID")) dosesPerDay = 4;
    else if (freqUpper.includes("DAILY") || freqUpper.includes("QD")) dosesPerDay = 1;
    return doseMg * dosesPerDay;
  }, [type, dose, frequency]);

  const maxDoseWarning = useMemo(() => {
    if (type !== "med" || !medication) return null;
    const max = MAX_DAILY_DOSE_MG[medication];
    if (!max || estimatedDailyDoseMg === null) return null;
    if (estimatedDailyDoseMg > max) {
      return `Estimated daily dose ${estimatedDailyDoseMg} mg exceeds recommended max ${max} mg/day.`;
    }
    return null;
  }, [type, medication, estimatedDailyDoseMg]);

  const organRiskWarning = useMemo(() => {
    if (type !== "med" || !medication) return null;
    const medLower = medication.toLowerCase();
    const renalSensitive = ["enoxaparin", "gabapentin", "metformin", "vancomycin", "heparin"].some((k) =>
      medLower.includes(k)
    );
    const hepaticSensitive = ["acetaminophen", "valproic", "statin", "methotrexate"].some((k) =>
      medLower.includes(k)
    );
    const warnings: string[] = [];
    if (renalRisk && renalSensitive) warnings.push("Renal risk: consider dose adjustment/monitoring.");
    if (hepaticRisk && hepaticSensitive) warnings.push("Hepatic risk: consider safer dosing and LFT monitoring.");
    return warnings.length > 0 ? warnings.join(" ") : null;
  }, [type, medication, renalRisk, hepaticRisk]);

  const pregnancyLactationWarning = useMemo(() => {
    if (type !== "med" || !medication) return null;
    const medLower = medication.toLowerCase();
    const cautionPregnancy = ["warfarin", "ace", "lisinopril", "losartan", "valproic", "doxycycline"].some((k) =>
      medLower.includes(k)
    );
    const cautionLactation = ["codeine", "tramadol", "benzodiazepine", "lorazepam"].some((k) =>
      medLower.includes(k)
    );
    const warnings: string[] = [];
    if (pregnancyStatus === "pregnant" && cautionPregnancy) {
      warnings.push("Pregnancy warning: verify fetal safety.");
    }
    if (lactationStatus === "lactating" && cautionLactation) {
      warnings.push("Lactation warning: assess infant exposure risk.");
    }
    return warnings.length > 0 ? warnings.join(" ") : null;
  }, [type, medication, pregnancyStatus, lactationStatus]);

  const explicitHighRiskMedication = useMemo(() => {
    if (type !== "med" || !medication.trim()) return false;
    const medLower = medication.toLowerCase();
    const highRiskKeywords = [
      "insulin", "heparin", "warfarin", "enoxaparin", "apixaban", "rivaroxaban",
      "morphine", "fentanyl", "hydromorphone", "methotrexate", "chemotherapy",
      "succinylcholine", "rocuronium", "cisatracurium", "epinephrine", "norepinephrine",
      "vasopressin", "dopamine", "dobutamine", "propofol", "midazolam", "ketamine",
    ];
    return isControlledSubstance || highRiskKeywords.some((k) => medLower.includes(k));
  }, [type, medication, isControlledSubstance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPlaceOrders) {
      setError(`${formatRoleLabel(currentUserRole)} cannot place new orders.`);
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    let resolvedEncounterId = selectedEncounterId || null;
    if (!resolvedEncounterId) {
      const { data: activeEncounter } = await supabase
        .from("encounters")
        .select("id")
        .eq("patient_id", patientId)
        .eq("status", "active")
        .order("admit_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedEncounterId = activeEncounter?.id || null;
    }

    let parsedDetails: Record<string, string> = {};
    if (type === "med") {
      if (!medication.trim()) {
        setError("Medication name is required.");
        setSaving(false);
        return;
      }
      if (isControlledSubstance && !controlledCode.trim()) {
        setError("Controlled substance authorization code is required.");
        setSaving(false);
        return;
      }
    } else if (type === "lab" && !labTest.trim() && !details.trim()) {
      setError("Enter a lab test (e.g. CBC, BMP).");
      setSaving(false);
      return;
    } else if (type === "imaging" && !imagingStudy.trim() && !details.trim()) {
      setError("Enter an imaging study (e.g. Chest X-ray).");
      setSaving(false);
      return;
    } else if (type === "procedure" && !procedureNote.trim() && !details.trim()) {
      setError("Enter a procedure description.");
      setSaving(false);
      return;
    }

    if (type === "med") {
      parsedDetails = {
        medication: medication.trim(),
        dose: dose.trim(),
        route: route.trim(),
        frequency: frequency.trim(),
        duration: duration.trim(),
        indication: indication.trim(),
        hold_reason: holdReason.trim(),
        ...(isControlledSubstance ? { controlled_code: controlledCode.trim() } : {}),
      };
    } else if (type === "lab") {
      const test = labTest.trim() || details.trim();
      parsedDetails = test ? { test, priority: labPriority } : {};
    } else if (type === "imaging") {
      const study = imagingStudy.trim() || details.trim();
      parsedDetails = study ? { study, priority: imagingPriority } : {};
    } else if (type === "procedure") {
      const note = procedureNote.trim() || details.trim();
      parsedDetails = note ? { note } : {};
    } else {
      try {
        if (details.trim()) {
          parsedDetails = JSON.parse(details) as Record<string, string>;
        }
      } catch {
        parsedDetails = { note: details };
      }
    }

    const isControlledOrHighRisk =
      type === "med" &&
      (isControlledSubstance ||
        explicitHighRiskMedication ||
        Boolean(maxDoseWarning || organRiskWarning || pregnancyLactationWarning));

    let pharmacyVerifiedAt: string | null = null;
    if (isControlledOrHighRisk) {
      const { data: inst } = await supabase
        .from("institution_settings")
        .select("bypass_pharmacy_verification")
        .eq("id", 1)
        .maybeSingle();
      if (inst?.bypass_pharmacy_verification) {
        pharmacyVerifiedAt = new Date().toISOString();
      }
    }

    const { error } = await supabase.from("orders").insert({
      patient_id: patientId,
      encounter_id: resolvedEncounterId,
      type,
      details: parsedDetails,
      protocol_set: protocolSet || null,
      hold_reason: type === "med" ? holdReason.trim() || null : null,
      is_controlled_substance: type === "med" ? isControlledSubstance : false,
      high_risk_med:
        type === "med"
          ? isControlledSubstance ||
            explicitHighRiskMedication ||
            Boolean(maxDoseWarning || organRiskWarning || pregnancyLactationWarning)
          : false,
      administration_frequency: type === "med" ? frequency.trim() || null : null,
      next_due_at:
        type === "med" && frequency.trim()
          ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
          : null,
      status: "pending",
      ordered_by: user.id,
      ...(pharmacyVerifiedAt ? { pharmacy_verified_at: pharmacyVerifiedAt } : {}),
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  };

  const typeTabs = [
    { value: "lab" as const, label: "Lab", icon: FlaskConical },
    { value: "med" as const, label: "Med", icon: Pill },
    { value: "imaging" as const, label: "Imaging", icon: Image },
    { value: "procedure" as const, label: "Procedure", icon: Stethoscope },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Place Order</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {typeTabs.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    type === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {type === "lab" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="lab-test">Test</Label>
                  <Input
                    id="lab-test"
                    placeholder="e.g. CBC, BMP, Troponin"
                    value={labTest}
                    onChange={(e) => setLabTest(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lab-priority">Priority</Label>
                  <select
                    id="lab-priority"
                    value={labPriority}
                    onChange={(e) => setLabPriority(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {type === "imaging" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="imaging-study">Study</Label>
                  <Input
                    id="imaging-study"
                    placeholder="e.g. Chest X-ray, CT Head"
                    value={imagingStudy}
                    onChange={(e) => setImagingStudy(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="imaging-priority">Priority</Label>
                  <select
                    id="imaging-priority"
                    value={imagingPriority}
                    onChange={(e) => setImagingPriority(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {type === "procedure" && (
              <div>
                <Label htmlFor="procedure-note">Procedure</Label>
                <Input
                  id="procedure-note"
                  placeholder="e.g. Lumbar puncture, Paracentesis"
                  value={procedureNote}
                  onChange={(e) => setProcedureNote(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {type === "med" && (
              <div className="space-y-3">
                <div>
                  <Label>Medication</Label>
                  <div className="mt-1 flex gap-2">
                    <Input value={medication} readOnly placeholder="Select medication" className="flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowMedicationPicker(true)}>
                      Pick
                    </Button>
                  </div>
                  {selectedMedicationOption?.aliases?.length ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedMedicationOption.aliases.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Dose</Label>
                    <Input placeholder="500 mg" value={dose} onChange={(e) => setDose(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Route</Label>
                    <Input
                      placeholder="PO, IV"
                      value={route}
                      onChange={(e) => {
                        const nextRoute = e.target.value;
                        setRoute(nextRoute);
                        const suggested = ROUTE_DEFAULT_FREQUENCY[nextRoute.toUpperCase()];
                        if (!frequency.trim() && suggested) setFrequency(suggested);
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Input placeholder="BID, Q6H" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Input placeholder="7 days" value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Indication</Label>
                  <Input placeholder="Reason" value={indication} onChange={(e) => setIndication(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Hold (optional)</Label>
                  <Input placeholder="e.g. Hold if SBP &lt; 100" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} className="mt-1" />
                </div>
                {isControlledSubstance && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2">
                    <Label>Auth code (required)</Label>
                    <Input
                      value={controlledCode}
                      onChange={(e) => setControlledCode(e.target.value)}
                      placeholder="Enter code"
                      className="mt-1"
                    />
                  </div>
                )}
                {explicitHighRiskMedication && (
                  <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                    High-risk medication: use independent double-checks and document witness in eMAR.
                  </p>
                )}
                {possibleAllergyConflict && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Allergy alert: this may conflict with recorded allergy &quot;
                    {possibleAllergyConflict}
                    &quot;.
                  </p>
                )}
                {duplicateClassWarning && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Duplicate class alert ({duplicateClassWarning.className}): existing active
                    meds include {duplicateClassWarning.duplicates.join(", ")}.
                  </p>
                )}
                {maxDoseWarning && (
                  <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
                    Max dose warning: {maxDoseWarning}
                  </p>
                )}
                {organRiskWarning && (
                  <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Safety warning: {organRiskWarning}
                  </p>
                )}
                {pregnancyLactationWarning && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    Pregnancy/Lactation: {pregnancyLactationWarning}
                  </p>
                )}
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                From protocol…
              </summary>
              <div className="mt-2 flex gap-2">
                <select
                  value={protocolSet}
                  onChange={(e) => setProtocolSet(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  <option value="chest_pain">Chest Pain</option>
                  <option value="abdominal_pain">Abdominal Pain</option>
                  <option value="trauma">Trauma</option>
                  <option value="sepsis">Sepsis</option>
                </select>
                {protocolSet && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const templates = ED_PROTOCOL_ORDER_SETS[protocolSet] || [];
                      const t = templates.find((r) => r.type === type);
                      if (!t) return;
                      if (type === "med") setIndication(t.details.note || "");
                      else if (type === "lab") {
                        setLabTest(t.details.test || "");
                        setLabPriority(t.details.priority || "STAT");
                      } else if (type === "imaging") {
                        setImagingStudy(t.details.study || "");
                        setImagingPriority(t.details.priority || "STAT");
                      }
                    }}
                  >
                    Apply
                  </Button>
                )}
              </div>
            </details>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!canPlaceOrders && (
              <p className="text-sm text-amber-700">
                Read-only for {formatRoleLabel(currentUserRole)}. Provider role required to
                place medication, lab, imaging, or procedure orders.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !canPlaceOrders}>
                {saving ? "Placing..." : "Place Order"}
              </Button>
            </div>
          </form>
          {showMedicationPicker && (
            <MedicationPickerModal
              open={showMedicationPicker}
              onClose={() => setShowMedicationPicker(false)}
              onSelect={(selected) => {
                setMedication(selected.name);
                if (!selected.controlled) {
                  setControlledCode("");
                }
                if (selected.defaultRoute && !route.trim()) {
                  setRoute(selected.defaultRoute);
                }
                if (selected.defaultFrequency && !frequency.trim()) {
                  setFrequency(selected.defaultFrequency);
                }
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
