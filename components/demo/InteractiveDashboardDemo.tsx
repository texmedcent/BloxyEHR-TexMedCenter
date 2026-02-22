"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  User,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LiveClock } from "@/components/chart/LiveClock";

type DemoPatient = {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
  dob: string;
  gender: "male" | "female" | "other";
  allergies: string[];
  problems: string[];
  encounters: { id: string; type: "outpatient" | "inpatient" | "ed"; status: "active" | "completed" }[];
  vitals: { id: string; type: string; value: string }[];
  triage?: boolean;
};

type DemoOrder = {
  id: string;
  patient_id: string;
  type: "med" | "lab" | "imaging" | "procedure";
  status: "pending" | "preliminary" | "final" | "completed";
};

type DemoResult = {
  id: string;
  patient_id: string;
  type: "lab" | "imaging" | "med" | "procedure";
  status: "preliminary" | "final";
};

const makeId = () => Math.random().toString(36).slice(2, 10);

export function InteractiveDashboardDemo() {
  const [patients, setPatients] = useState<DemoPatient[]>([
    {
      id: makeId(),
      first_name: "Mia",
      last_name: "Johnson",
      mrn: "MRN1061",
      dob: "2001-05-13",
      gender: "female",
      allergies: ["Penicillin"],
      problems: ["Asthma"],
      encounters: [{ id: makeId(), type: "outpatient", status: "active" }],
      vitals: [
        { id: makeId(), type: "blood_pressure", value: "118/76" },
        { id: makeId(), type: "heart_rate", value: "82" },
      ],
      triage: true,
    },
    {
      id: makeId(),
      first_name: "Ethan",
      last_name: "Walker",
      mrn: "MRN1062",
      dob: "1998-11-02",
      gender: "male",
      allergies: ["Latex"],
      problems: ["Hypertension"],
      encounters: [{ id: makeId(), type: "ed", status: "completed" }],
      vitals: [
        { id: makeId(), type: "blood_pressure", value: "132/88" },
        { id: makeId(), type: "heart_rate", value: "90" },
      ],
    },
    {
      id: makeId(),
      first_name: "Noah",
      last_name: "Davis",
      mrn: "MRN1063",
      dob: "2004-02-21",
      gender: "other",
      allergies: [],
      problems: ["Migraine"],
      encounters: [{ id: makeId(), type: "outpatient", status: "active" }],
      vitals: [{ id: makeId(), type: "temperature", value: "99.1 F" }],
    },
  ]);
  const [orders, setOrders] = useState<DemoOrder[]>([
    { id: makeId(), patient_id: "", type: "lab", status: "pending" },
    { id: makeId(), patient_id: "", type: "imaging", status: "preliminary" },
    { id: makeId(), patient_id: "", type: "med", status: "completed" },
  ]);
  const [results] = useState<DemoResult[]>([
    { id: makeId(), patient_id: "", type: "lab", status: "final" },
    { id: makeId(), patient_id: "", type: "imaging", status: "preliminary" },
  ]);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [newAllergy, setNewAllergy] = useState("");
  const [newProblem, setNewProblem] = useState("");
  const [newVitalType, setNewVitalType] = useState("blood_pressure");
  const [newVitalValue, setNewVitalValue] = useState("");

  // Keep demo records linked to existing patients.
  const hydratedOrders = useMemo(() => {
    if (!patients.length) return [];
    return orders.map((o, i) => ({
      ...o,
      patient_id: o.patient_id || patients[i % patients.length].id,
    }));
  }, [orders, patients]);

  const hydratedResults = useMemo(() => {
    if (!patients.length) return [];
    return results.map((r, i) => ({
      ...r,
      patient_id: r.patient_id || patients[(i + 1) % patients.length].id,
    }));
  }, [results, patients]);

  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const activeEncounterCount = useMemo(
    () => Math.max(0, patients.filter((p) => p.triage).length + 2),
    [patients]
  );

  const promoteFromTriage = (id: string) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, triage: false } : p)));
    setOrders((prev) => [
      {
        id: makeId(),
        patient_id: id,
        type: "lab",
        status: "pending",
      },
      ...prev,
    ]);
  };

  const addChart = () => {
    if (!newFirst.trim() || !newLast.trim()) return;
    const mrnNum = (1000 + patients.length + 70).toString();
    setPatients((prev) => [
      {
        id: makeId(),
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        mrn: `MRN${mrnNum}`,
        dob: "2000-01-01",
        gender: "other",
        allergies: [],
        problems: [],
        encounters: [{ id: makeId(), type: "outpatient", status: "active" }],
        vitals: [],
      },
      ...prev,
    ]);
    setNewFirst("");
    setNewLast("");
  };

  const updatePatient = (id: string, updater: (p: DemoPatient) => DemoPatient) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  };

  const cycleOrderStatus = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (o.status === "pending") return { ...o, status: "preliminary" };
        if (o.status === "preliminary") return { ...o, status: "final" };
        return o;
      })
    );
  };

  const selectedPatient = selectedPatientId
    ? patients.find((p) => p.id === selectedPatientId) || null
    : null;

  const addAllergy = () => {
    if (!selectedPatient || !newAllergy.trim()) return;
    updatePatient(selectedPatient.id, (p) => ({
      ...p,
      allergies: [...p.allergies, newAllergy.trim()],
    }));
    setNewAllergy("");
  };

  const addProblem = () => {
    if (!selectedPatient || !newProblem.trim()) return;
    updatePatient(selectedPatient.id, (p) => ({
      ...p,
      problems: [newProblem.trim(), ...p.problems],
    }));
    setNewProblem("");
  };

  const upsertVital = () => {
    if (!selectedPatient || !newVitalValue.trim()) return;
    updatePatient(selectedPatient.id, (p) => {
      const idx = p.vitals.findIndex((v) => v.type === newVitalType);
      if (idx < 0) {
        return {
          ...p,
          vitals: [{ id: makeId(), type: newVitalType, value: newVitalValue.trim() }, ...p.vitals],
        };
      }
      const next = [...p.vitals];
      next[idx] = { ...next[idx], value: newVitalValue.trim() };
      return { ...p, vitals: next };
    });
    setNewVitalValue("");
  };

  const startEncounter = () => {
    if (!selectedPatient) return;
    updatePatient(selectedPatient.id, (p) => ({
      ...p,
      encounters: [{ id: makeId(), type: "outpatient", status: "active" }, ...p.encounters],
    }));
  };

  const endEncounter = (encId: string) => {
    if (!selectedPatient) return;
    updatePatient(selectedPatient.id, (p) => ({
      ...p,
      encounters: p.encounters.map((e) => (e.id === encId ? { ...e, status: "completed" } : e)),
    }));
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden w-56 flex-col bg-[#1a4d8c] text-white md:flex">
          <div className="border-b border-white/20 p-3">
            <BehrLogo compact className="text-white [&_p]:text-white" />
          </div>
          <nav className="space-y-1 p-2">
            {[
              { label: "Patient Chart", icon: LayoutDashboard },
              { label: "Clinical Documentation", icon: ClipboardList },
              { label: "Order Entry", icon: ClipboardList },
              { label: "Results", icon: FlaskConical },
            ].map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded px-3 py-2.5 text-sm hover:bg-white/10"
              >
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3">
            <div className="flex items-center gap-3">
              <BehrLogo compact />
              <Badge variant="outline" className="border-[#1a4d8c]/30 text-[#1a4d8c]">
                Interactive Demo
              </Badge>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                Exit Demo
              </Button>
            </Link>
          </header>

          <main className="flex-1 overflow-auto p-3 md:p-4">
            <div className="space-y-4">
              {selectedPatient ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedPatientId(null)}>
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Dashboard
                      </Button>
                      <h1 className="text-xl font-semibold text-slate-900">
                        {selectedPatient.last_name}, {selectedPatient.first_name}
                      </h1>
                      <Badge variant="outline">MRN: {selectedPatient.mrn}</Badge>
                    </div>
                    <LiveClock />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Demographics</CardTitle></CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p><span className="text-slate-500">DOB:</span> {selectedPatient.dob}</p>
                        <p><span className="text-slate-500">Gender:</span> {selectedPatient.gender}</p>
                        <p><span className="text-slate-500">Name:</span> {selectedPatient.first_name} {selectedPatient.last_name}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-sm">Allergies</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={newAllergy}
                            onChange={(e) => setNewAllergy(e.target.value)}
                            placeholder="Add allergy"
                          />
                          <Button onClick={addAllergy}>Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {selectedPatient.allergies.length ? (
                            selectedPatient.allergies.map((a) => (
                              <Badge key={a} variant="outline">{a}</Badge>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No allergies documented</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">Encounter History</CardTitle>
                        <Button size="sm" variant="outline" onClick={startEncounter}>
                          Start New Encounter
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedPatient.encounters.map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
                            <div>
                              <span className="capitalize font-medium">{e.type}</span>
                              <Badge variant="outline" className="ml-2 capitalize">{e.status}</Badge>
                            </div>
                            {e.status === "active" ? (
                              <Button size="sm" variant="outline" onClick={() => endEncounter(e.id)}>
                                End
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-sm">Problem List</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={newProblem}
                            onChange={(e) => setNewProblem(e.target.value)}
                            placeholder="Add problem"
                          />
                          <Button onClick={addProblem}>Add</Button>
                        </div>
                        <ul className="space-y-1 text-sm">
                          {selectedPatient.problems.map((p) => (
                            <li key={p} className="rounded border border-slate-200 px-2 py-1">{p}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Vitals</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                          <select
                            value={newVitalType}
                            onChange={(e) => setNewVitalType(e.target.value)}
                            className="h-9 rounded border border-slate-300 bg-white px-2 text-sm"
                          >
                            <option value="blood_pressure">Blood Pressure</option>
                            <option value="heart_rate">Heart Rate</option>
                            <option value="temperature">Temperature</option>
                            <option value="respiratory_rate">Respiratory Rate</option>
                          </select>
                          <Input
                            value={newVitalValue}
                            onChange={(e) => setNewVitalValue(e.target.value)}
                            placeholder="Value"
                          />
                          <Button onClick={upsertVital}>Save</Button>
                        </div>
                        <ul className="space-y-1 text-sm">
                          {selectedPatient.vitals.map((v) => (
                            <li key={v.id} className="rounded border border-slate-200 px-2 py-1">
                              <span className="font-medium">{v.type.replaceAll("_", " ")}</span>: {v.value}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader><CardTitle className="text-sm">Medication List</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {hydratedOrders
                          .filter((o) => o.patient_id === selectedPatient.id && o.type === "med")
                          .map((m) => (
                            <div key={m.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-sm">
                              <span>{m.type.toUpperCase()} Order</span>
                              <Badge variant="outline" className="capitalize">{m.status}</Badge>
                            </div>
                          ))}
                        {hydratedOrders.filter((o) => o.patient_id === selectedPatient.id && o.type === "med").length === 0 && (
                          <p className="text-sm text-slate-500">No active medications</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold text-slate-900">Chart Dashboard (Demo)</h1>
                <LiveClock />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-600" />
                      Ongoing Encounters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-slate-900">{activeEncounterCount}</div>
                    <p className="text-xs text-slate-500 mt-1">Interactive demo count</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-[#1a4d8c]" />
                      Recent Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-slate-900">{hydratedOrders.length}</div>
                    <p className="text-xs text-slate-500 mt-1">Status updates are local</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-indigo-600" />
                      Recent Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-slate-900">{hydratedResults.length}</div>
                    <p className="text-xs text-slate-500 mt-1">Demo result feed</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Recent Orders</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {hydratedOrders.map((order) => {
                        const p = patientMap.get(order.patient_id);
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => cycleOrderStatus(order.id)}
                            className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium capitalize">{order.type}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {p ? `${p.last_name}, ${p.first_name} (MRN: ${p.mrn})` : "Unknown patient"}
                              </p>
                            </div>
                            <Badge variant="outline" className="capitalize">{order.status}</Badge>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Click an order row to cycle status (pending → preliminary → final).
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Recent Results</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {hydratedResults.map((result) => {
                        const p = patientMap.get(result.patient_id);
                        return (
                          <div
                            key={result.id}
                            className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium capitalize">{result.type}</p>
                              <p className="text-xs text-slate-500 truncate">
                                {p ? `${p.last_name}, ${p.first_name} (MRN: ${p.mrn})` : "Unknown patient"}
                              </p>
                            </div>
                            <Badge variant="outline" className="capitalize">{result.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Quick Access: Patients</CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newFirst}
                      onChange={(e) => setNewFirst(e.target.value)}
                      placeholder="First"
                      className="h-8 w-24"
                    />
                    <Input
                      value={newLast}
                      onChange={(e) => setNewLast(e.target.value)}
                      placeholder="Last"
                      className="h-8 w-24"
                    />
                    <Button size="sm" className="h-8" onClick={addChart}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      New Chart
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {patients.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between gap-2 rounded-md border p-3 ${
                          p.triage ? "border-amber-300 bg-amber-50" : "bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <User className={`h-4 w-4 ${p.triage ? "text-amber-700" : "text-[#1a4d8c]"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.last_name}, {p.first_name}</p>
                            <p className="text-xs text-slate-500">MRN: {p.mrn}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.triage && <Badge className="bg-orange-500 text-white">TRIAGE</Badge>}
                          {p.triage ? (
                            <Button size="sm" className="h-7 text-xs" onClick={() => promoteFromTriage(p.id)}>
                              Start Encounter
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setSelectedPatientId(p.id)}
                          >
                            Open Chart
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </main>
  );
}
