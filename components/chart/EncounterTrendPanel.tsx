"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TrendPoint {
  ts: string;
  value: number;
}

interface EncounterTrendPanelProps {
  vitals: {
    type: string;
    value: string;
    recorded_at: string;
  }[];
  labs: {
    analyte: string;
    value: number;
    reported_at: string;
  }[];
}

function asSparkline(points: TrendPoint[]): string {
  if (points.length === 0) return "";
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((p.value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

function parseVitalValue(raw: string): number | null {
  if (!raw) return null;
  if (raw.includes("/")) {
    const top = Number(raw.split("/")[0]);
    return Number.isNaN(top) ? null : top;
  }
  const match = raw.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isNaN(n) ? null : n;
}

function TrendCard({
  label,
  points,
  colorClass,
}: {
  label: string;
  points: TrendPoint[];
  colorClass: string;
}) {
  const sorted = [...points].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const polyline = asSparkline(sorted);
  const latest = sorted.length > 0 ? sorted[sorted.length - 1].value : null;
  return (
    <div className="rounded border border-slate-200 p-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      {sorted.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">No points yet</p>
      ) : (
        <div className="mt-1">
          <svg viewBox="0 0 100 100" className="h-16 w-full">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              points={polyline}
              className={colorClass}
            />
          </svg>
          <p className="text-xs text-slate-500">Latest: {latest}</p>
        </div>
      )}
    </div>
  );
}

export function EncounterTrendPanel({ vitals, labs }: EncounterTrendPanelProps) {
  const hr: TrendPoint[] = [];
  const bp: TrendPoint[] = [];
  const spo2: TrendPoint[] = [];
  for (const row of vitals) {
    const v = parseVitalValue(row.value);
    if (v === null) continue;
    if (row.type.toLowerCase().includes("heart")) hr.push({ ts: row.recorded_at, value: v });
    if (row.type.toLowerCase().includes("blood")) bp.push({ ts: row.recorded_at, value: v });
    if (row.type.toLowerCase().includes("spo2")) spo2.push({ ts: row.recorded_at, value: v });
  }
  const lactate = labs
    .filter((l) => l.analyte.toLowerCase().includes("lactate"))
    .map((l) => ({ ts: l.reported_at, value: l.value }));
  const troponin = labs
    .filter((l) => l.analyte.toLowerCase().includes("troponin"))
    .map((l) => ({ ts: l.reported_at, value: l.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Encounter Trends</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <TrendCard label="HR" points={hr} colorClass="text-rose-500" />
        <TrendCard label="BP (Systolic)" points={bp} colorClass="text-blue-500" />
        <TrendCard label="SpO2" points={spo2} colorClass="text-emerald-500" />
        <TrendCard label="Lactate" points={lactate} colorClass="text-amber-500" />
        <TrendCard label="Troponin" points={troponin} colorClass="text-violet-500" />
      </CardContent>
    </Card>
  );
}
