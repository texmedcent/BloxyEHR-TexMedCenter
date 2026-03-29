"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { FALLBACK_CAMPUSES, normalizeCareSetting, type CampusOption, type CareSetting } from "@/lib/campuses";

type FoundPatient = {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
};

function generateRandomMrn() {
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const stamp = Date.now().toString().slice(-5);
  return `PT${stamp}${rand}`;
}

export function StartChartCard() {
  const [open, setOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [triageLoading, setTriageLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [matches, setMatches] = useState<FoundPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDob, setSearchDob] = useState("");
  const [searchResults, setSearchResults] = useState<FoundPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<FoundPatient | null>(null);
  const [triagePatient, setTriagePatient] = useState<FoundPatient | null>(null);
  const [campuses, setCampuses] = useState<CampusOption[]>(FALLBACK_CAMPUSES);
  const [campus, setCampus] = useState<string>(FALLBACK_CAMPUSES[0]?.name || "Primary Care Office");
  const [careSetting, setCareSetting] = useState<CareSetting>("outpatient");
  const [triageAcuity, setTriageAcuity] = useState<"esi_1" | "esi_2" | "esi_3" | "esi_4" | "esi_5">("esi_3");
  const [triagePain, setTriagePain] = useState("0");
  const [triageArrivalMode, setTriageArrivalMode] = useState<"walk_in" | "ambulance">("walk_in");
  const [triageChiefComplaint, setTriageChiefComplaint] = useState("");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error: campusError } = await supabase
        .from("institution_campuses")
        .select("id, name, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!campusError && data && data.length > 0) {
        setCampuses(data);
        setCampus((current) => (data.some((row) => row.name === current) ? current : data[0].name));
      }
    })();
  }, []);

  const closeAll = () => {
    setOpen(false);
    setTriageOpen(false);
    setSelectedPatient(null);
    setTriagePatient(null);
    setTriageAcuity("esi_3");
    setTriagePain("0");
    setTriageArrivalMode("walk_in");
    setTriageChiefComplaint("");
    setTriageError(null);
  };

  const beginTriageForPatient = (patient: FoundPatient) => {
    setTriagePatient(patient);
    setOpen(false);
    setTriageError(null);
    setTriageAcuity("esi_3");
    setTriagePain("0");
    setTriageArrivalMode("walk_in");
    setTriageChiefComplaint("");
    setTriageOpen(true);
  };

  const searchExisting = async () => {
    const supabase = createClient();
    const { data, error: searchError } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name, dob")
      .ilike("first_name", `%${firstName.trim()}%`)
      .ilike("last_name", `%${lastName.trim()}%`)
      .eq("dob", dob)
      .order("created_at", { ascending: false })
      .limit(5);
    if (searchError) {
      setError(searchError.message);
      return [];
    }
    return data || [];
  };

  const runPatientSearch = async () => {
    setError(null);
    setSearchResults([]);
    const query = searchQuery.trim();

    if (!query && !searchDob) {
      setError("Enter a name/MRN and/or DOB to search patients.");
      return;
    }

    setSearchLoading(true);
    const supabase = createClient();
    let builder = supabase
      .from("patients")
      .select("id, mrn, first_name, last_name, dob")
      .order("created_at", { ascending: false })
      .limit(10);

    if (query) {
      builder = builder.or(
        `mrn.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
      );
    }
    if (searchDob) {
      builder = builder.eq("dob", searchDob);
    }

    const { data, error: searchError } = await builder;
    setSearchLoading(false);
    if (searchError) {
      setError(searchError.message);
      return;
    }
    setSearchResults(data || []);
  };

  const createNewChart = async () => {
    const supabase = createClient();
    const mrn = generateRandomMrn();
    const { data, error: createError } = await supabase
      .from("patients")
      .insert({
        mrn,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob,
        gender: gender || null,
        contact_info: {},
        allergies: [],
      })
      .select("id, mrn, first_name, last_name, dob")
      .single();

    if (createError || !data) {
      setError(createError?.message || "Unable to create patient chart.");
      return null;
    }
    return data as FoundPatient;
  };

  const submitTriageIntake = async () => {
    const chiefComplaint = triageChiefComplaint.trim();
    const parsedPain = Number(triagePain);
    if (!triagePatient) {
      setTriageError("Select a patient first.");
      return;
    }
    if (!chiefComplaint) {
      setTriageError("Chief complaint is required.");
      return;
    }
    if (Number.isNaN(parsedPain) || parsedPain < 0 || parsedPain > 10) {
      setTriageError("Pain must be between 0 and 10.");
      return;
    }
    setTriageLoading(true);
    setTriageError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTriageLoading(false);
      setTriageError("You must be signed in.");
      return;
    }

    const { data: existingTriage } = await supabase
      .from("patient_checkins")
      .select("id")
      .eq("patient_id", triagePatient.id)
      .in("status", ["triage", "in_encounter"])
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTriage?.id) {
      setTriageLoading(false);
      closeAll();
      router.refresh();
      return;
    }

    const { error: checkinError } = await supabase.from("patient_checkins").insert({
      auth_user_id: user.id,
      patient_id: triagePatient.id,
      campus,
      care_setting: normalizeCareSetting(careSetting),
      status: "triage",
      chief_complaint: chiefComplaint,
      arrival_mode: triageArrivalMode,
      acuity_level: triageAcuity,
      pain_score: parsedPain,
    });

    setTriageLoading(false);
    if (checkinError) {
      setTriageError(checkinError.message);
      return;
    }

    closeAll();
    router.refresh();
  };

  const skipTriageAndOpenChart = () => {
    if (!triagePatient) {
      setTriageError("Select a patient first.");
      return;
    }
    const patientId = triagePatient.id;
    closeAll();
    router.push(`/chart/${patientId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMatches([]);

    if (!firstName.trim() || !lastName.trim() || !dob) {
      setError("First name, last name, and DOB are required.");
      return;
    }

    setLoading(true);
    const found = await searchExisting();
    if (found.length > 0) {
      setMatches(found);
      setLoading(false);
      return;
    }

    const created = await createNewChart();
    if (created) {
      beginTriageForPatient(created);
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        size="sm"
        className="h-8 rounded-lg"
        onClick={() => {
          setError(null);
          setMatches([]);
          setSearchResults([]);
          setSelectedPatient(null);
          setOpen(true);
        }}
      >
        New Chart
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Start New Patient Chart</CardTitle>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/40 p-3">
                <p className="text-sm font-medium text-slate-900 dark:text-foreground">Search Existing Patient</p>
                <p className="text-xs text-slate-500 dark:text-muted-foreground">
                  Search by name or MRN (optionally add DOB), then open the chart directly.
                </p>
                <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name or MRN"
                  />
                  <Input
                    type="date"
                    value={searchDob}
                    onChange={(e) => setSearchDob(e.target.value)}
                  />
                  <Button type="button" variant="outline" disabled={searchLoading} onClick={runPatientSearch}>
                    {searchLoading ? "Searching..." : "Search Patients"}
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((patient) => (
                      <div
                        key={patient.id}
                        className="flex items-center justify-between rounded border border-slate-200 dark:border-border bg-white dark:bg-card px-2 py-1.5"
                      >
                        <div className="text-sm">
                          <p className="font-medium text-slate-900 dark:text-foreground">
                            {patient.last_name}, {patient.first_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-muted-foreground">
                            MRN: {patient.mrn} · DOB: {patient.dob}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPatient(patient);
                            beginTriageForPatient(patient);
                          }}
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>First Name</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1"
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Gender (optional)</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  >
                    <option value="">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Checking..." : "Create / Open Chart"}
                  </Button>
                </div>
              </form>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {selectedPatient && (
                <p className="text-xs text-slate-600 dark:text-muted-foreground">
                  Selected: {selectedPatient.last_name}, {selectedPatient.first_name} ({selectedPatient.mrn})
                </p>
              )}

              {matches.length > 0 && (
                <div className="space-y-2 rounded border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    Existing records found with same name + DOB
                  </p>
                  <div className="space-y-2">
                    {matches.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded border border-amber-200 dark:border-amber-700/60 bg-white dark:bg-card px-2 py-1.5"
                      >
                        <div className="text-sm">
                          <p className="font-medium text-slate-900 dark:text-foreground">
                            {m.last_name}, {m.first_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-muted-foreground">
                            MRN: {m.mrn} · DOB: {m.dob}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPatient(m);
                            beginTriageForPatient(m);
                          }}
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={async () => {
                        setLoading(true);
                        const created = await createNewChart();
                        if (created) {
                          beginTriageForPatient(created);
                        }
                        setLoading(false);
                      }}
                    >
                      Create New Anyway
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {triageOpen && triagePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Quick Triage Intake</CardTitle>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={closeAll}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-muted-foreground">
                {triagePatient.last_name}, {triagePatient.first_name} · MRN {triagePatient.mrn}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Campus Location</Label>
                  <select
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                    className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Care Setting</Label>
                  <select
                    value={careSetting}
                    onChange={(e) => setCareSetting(normalizeCareSetting(e.target.value))}
                    className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                  >
                    <option value="outpatient">Out Patient</option>
                    <option value="inpatient">In Patient</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>ESI</Label>
                    <select
                      value={triageAcuity}
                      onChange={(e) =>
                        setTriageAcuity(e.target.value as "esi_1" | "esi_2" | "esi_3" | "esi_4" | "esi_5")
                      }
                      className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                    >
                      <option value="esi_1">ESI 1</option>
                      <option value="esi_2">ESI 2</option>
                      <option value="esi_3">ESI 3</option>
                      <option value="esi_4">ESI 4</option>
                      <option value="esi_5">ESI 5</option>
                    </select>
                  </div>
                  <div>
                    <Label>Pain (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={triagePain}
                      onChange={(e) => setTriagePain(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Arrival</Label>
                    <select
                      value={triageArrivalMode}
                      onChange={(e) => setTriageArrivalMode(e.target.value as "walk_in" | "ambulance")}
                      className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-slate-900 dark:text-foreground"
                    >
                      <option value="walk_in">Walk In</option>
                      <option value="ambulance">Ambulance</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <Label>CC (Chief Complaint)</Label>
                <Textarea
                  value={triageChiefComplaint}
                  onChange={(e) => setTriageChiefComplaint(e.target.value)}
                  placeholder="Enter chief complaint"
                  className="mt-1 min-h-[90px]"
                />
              </div>
              {triageError && <p className="text-sm text-red-600">{triageError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeAll}>
                  Cancel
                </Button>
                <Button type="button" variant="outline" onClick={skipTriageAndOpenChart} disabled={triageLoading}>
                  Skip Triage
                </Button>
                <Button type="button" onClick={submitTriageIntake} disabled={triageLoading}>
                  {triageLoading ? "Saving..." : "Send to Triage Queue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
