"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BehrLogo } from "@/components/branding/BehrLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type DemoTab = "chart" | "documentation" | "orders" | "results";

interface DemoOrder {
  id: string;
  type: "med" | "lab" | "imaging";
  name: string;
  status: "pending" | "preliminary" | "final";
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function DemoEhrWorkspace() {
  const [tab, setTab] = useState<DemoTab>("chart");
  const [name, setName] = useState("Alex Carter");
  const [allergies, setAllergies] = useState("Penicillin");
  const [vitalType, setVitalType] = useState("blood_pressure");
  const [vitalValue, setVitalValue] = useState("120/80");
  const [vitals, setVitals] = useState<{ id: string; type: string; value: string }[]>([
    { id: uid(), type: "blood_pressure", value: "120/80" },
    { id: uid(), type: "heart_rate", value: "84" },
  ]);
  const [soapS, setSoapS] = useState("Patient reports sore throat and fever for 2 days.");
  const [soapO, setSoapO] = useState("Temp 100.6 F, mild pharyngeal erythema.");
  const [soapA, setSoapA] = useState("Likely viral pharyngitis.");
  const [soapP, setSoapP] = useState("Supportive care, hydration, follow-up PRN.");
  const [orders, setOrders] = useState<DemoOrder[]>([
    { id: uid(), type: "lab", name: "CBC", status: "pending" },
    { id: uid(), type: "imaging", name: "Chest X-Ray", status: "preliminary" },
    { id: uid(), type: "med", name: "Amoxicillin 500 mg PO BID", status: "final" },
  ]);
  const [newOrderType, setNewOrderType] = useState<DemoOrder["type"]>("lab");
  const [newOrderName, setNewOrderName] = useState("");

  const finalResults = useMemo(
    () => orders.filter((o) => o.type !== "med" && o.status === "final"),
    [orders]
  );

  const upsertVital = () => {
    if (!vitalValue.trim()) return;
    setVitals((prev) => {
      const idx = prev.findIndex((v) => v.type === vitalType);
      if (idx < 0) return [{ id: uid(), type: vitalType, value: vitalValue.trim() }, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], value: vitalValue.trim() };
      return next;
    });
    setVitalValue("");
  };

  const addOrder = () => {
    if (!newOrderName.trim()) return;
    setOrders((prev) => [
      { id: uid(), type: newOrderType, name: newOrderName.trim(), status: "pending" },
      ...prev,
    ]);
    setNewOrderName("");
  };

  const cycleStatus = (id: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id || o.type === "med") return o;
        if (o.status === "pending") return { ...o, status: "preliminary" };
        if (o.status === "preliminary") return { ...o, status: "final" };
        return o;
      })
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BehrLogo compact />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[#1a4d8c] border-[#1a4d8c]/30 bg-[#1a4d8c]/5">
                Demo Mode (No Sign-In)
              </Badge>
              <Link href="/">
                <Button variant="outline" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Interactive sandbox: all edits are local-only and reset when you reload or leave.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {(["chart", "documentation", "orders", "results"] as DemoTab[]).map((t) => (
            <Button
              key={t}
              variant={tab === t ? "default" : "outline"}
              className={tab === t ? "bg-[#1a4d8c] hover:bg-[#1a4d8c]/90" : ""}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>

        {tab === "chart" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Patient Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Allergies</Label>
                  <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Vitals (Demo Upsert)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                  <select
                    value={vitalType}
                    onChange={(e) => setVitalType(e.target.value)}
                    className="h-9 rounded border border-slate-300 bg-white px-2 text-sm"
                  >
                    <option value="blood_pressure">Blood Pressure</option>
                    <option value="heart_rate">Heart Rate</option>
                    <option value="temperature">Temperature</option>
                    <option value="respiratory_rate">Respiratory Rate</option>
                  </select>
                  <Input value={vitalValue} onChange={(e) => setVitalValue(e.target.value)} />
                  <Button onClick={upsertVital}>Save</Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {vitals.map((v) => (
                    <li key={v.id} className="rounded border border-slate-200 px-2 py-1">
                      <span className="font-medium">{v.type.replaceAll("_", " ")}</span>: {v.value}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "documentation" && (
          <Card>
            <CardHeader><CardTitle>SOAP Note Demo</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Subjective</Label>
                <Textarea className="mt-1" value={soapS} onChange={(e) => setSoapS(e.target.value)} />
              </div>
              <div>
                <Label>Objective</Label>
                <Textarea className="mt-1" value={soapO} onChange={(e) => setSoapO(e.target.value)} />
              </div>
              <div>
                <Label>Assessment</Label>
                <Textarea className="mt-1" value={soapA} onChange={(e) => setSoapA(e.target.value)} />
              </div>
              <div>
                <Label>Plan</Label>
                <Textarea className="mt-1" value={soapP} onChange={(e) => setSoapP(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "orders" && (
          <Card>
            <CardHeader><CardTitle>Order Entry Demo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-[140px_1fr_auto]">
                <select
                  value={newOrderType}
                  onChange={(e) => setNewOrderType(e.target.value as DemoOrder["type"])}
                  className="h-9 rounded border border-slate-300 bg-white px-2 text-sm"
                >
                  <option value="lab">Lab</option>
                  <option value="imaging">Imaging</option>
                  <option value="med">Medication</option>
                </select>
                <Input
                  value={newOrderName}
                  onChange={(e) => setNewOrderName(e.target.value)}
                  placeholder="Order name/details"
                />
                <Button onClick={addOrder}>Add Order</Button>
              </div>
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium capitalize">{o.type}</span> - {o.name}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => cycleStatus(o.id)} className="capitalize">
                      {o.status}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {tab === "results" && (
          <Card>
            <CardHeader><CardTitle>Results Demo (Final Only)</CardTitle></CardHeader>
            <CardContent>
              {finalResults.length === 0 ? (
                <p className="text-sm text-slate-500">No final results yet. Finalize a lab/imaging order first.</p>
              ) : (
                <ul className="space-y-2">
                  {finalResults.map((r) => (
                    <li key={r.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                      <span className="font-medium capitalize">{r.type}</span>: {r.name}{" "}
                      <Badge className="ml-2 bg-emerald-600 hover:bg-emerald-600">Final</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
