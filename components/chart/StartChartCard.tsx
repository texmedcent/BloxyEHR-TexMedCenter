"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<FoundPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDob, setSearchDob] = useState("");
  const [searchResults, setSearchResults] = useState<FoundPatient[]>([]);
  const router = useRouter();

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
      .select("id")
      .single();

    if (createError || !data) {
      setError(createError?.message || "Unable to create patient chart.");
      return;
    }
    setOpen(false);
    router.push(`/chart/${data.id}`);
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

    await createNewChart();
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
              <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">Search Existing Patient</p>
                <p className="text-xs text-slate-500">
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
                        className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <div className="text-sm">
                          <p className="font-medium">
                            {patient.last_name}, {patient.first_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            MRN: {patient.mrn} · DOB: {patient.dob}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOpen(false);
                            router.push(`/chart/${patient.id}`);
                          }}
                        >
                          Open Chart
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
                    className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
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

              {matches.length > 0 && (
                <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    Existing records found with same name + DOB
                  </p>
                  <div className="space-y-2">
                    {matches.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded border border-amber-200 bg-white px-2 py-1.5"
                      >
                        <div className="text-sm">
                          <p className="font-medium">
                            {m.last_name}, {m.first_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            MRN: {m.mrn} · DOB: {m.dob}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOpen(false);
                            router.push(`/chart/${m.id}`);
                          }}
                        >
                          Open Chart
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={async () => {
                        setLoading(true);
                        await createNewChart();
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
    </>
  );
}
