"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type IcdRow = {
  code: string;
  label: string;
  category_key: string | null;
  is_active: boolean;
};

const ICD_CATEGORY_KEYS = [
  "infectious",
  "endocrine",
  "mental_health",
  "neuro",
  "ent_eye",
  "cardio",
  "respiratory",
  "gi",
  "gu",
  "obstetric",
  "musculoskeletal",
  "skin",
  "trauma_injury",
  "external_causes",
  "symptoms",
  "followup_zcodes",
] as const;

const CATEGORY_LABELS: Record<(typeof ICD_CATEGORY_KEYS)[number], string> = {
  infectious: "Infectious",
  endocrine: "Endocrine/Metabolic",
  mental_health: "Mental Health",
  neuro: "Neuro",
  ent_eye: "ENT/Eye",
  cardio: "Cardiovascular",
  respiratory: "Respiratory",
  gi: "GI/Hepatobiliary",
  gu: "GU/Renal/Repro",
  obstetric: "Obstetric",
  musculoskeletal: "Musculoskeletal",
  skin: "Skin",
  trauma_injury: "Trauma/Injury",
  external_causes: "External Causes",
  symptoms: "Symptoms/General",
  followup_zcodes: "Follow-up/Z-Codes",
};

const CATEGORY_PREFIX: Record<(typeof ICD_CATEGORY_KEYS)[number], string> = {
  infectious: "A",
  endocrine: "E",
  mental_health: "F",
  neuro: "G",
  ent_eye: "H",
  cardio: "I",
  respiratory: "J",
  gi: "K",
  gu: "N",
  obstetric: "O",
  musculoskeletal: "M",
  skin: "L",
  trauma_injury: "T",
  external_causes: "X",
  symptoms: "R",
  followup_zcodes: "Z",
};

function generateRandomCode(category: (typeof ICD_CATEGORY_KEYS)[number]) {
  const prefix = CATEGORY_PREFIX[category];
  const major = Math.floor(Math.random() * 90) + 10;
  const minor = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${major}.${minor}`;
}

export function InstitutionIcd10Manager({ initialRows }: { initialRows: IcdRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [category, setCategory] = useState<(typeof ICD_CATEGORY_KEYS)[number]>("symptoms");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const addCode = async () => {
    if (!label.trim()) {
      setMessage("Diagnosis label is required.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    let inserted: IcdRow | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = generateRandomCode(category);
      const { data, error } = await supabase
        .from("icd10_catalog")
        .insert({
          code,
          label: label.trim(),
          category_key: category,
          is_billable: false,
          is_active: true,
        })
        .select("code, label, category_key, is_active")
        .single();

      if (!error && data) {
        inserted = data;
        break;
      }
      lastError = error?.message || "Unknown error";
      if (!lastError.toLowerCase().includes("duplicate")) {
        break;
      }
    }

    setSaving(false);
    if (!inserted) {
      setMessage(`Failed to add ICD-10 code: ${lastError}`);
      return;
    }

    setRows((prev) => [inserted!, ...prev]);
    setLabel("");
    setMessage(`Added ${inserted.code} (${CATEGORY_LABELS[category]}).`);
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card p-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">ICD-10 Catalog Manager</h3>
      <p className="text-xs text-slate-500 dark:text-muted-foreground">
        Add custom diagnosis entries. A random ICD-style code is auto-generated from the selected section.
      </p>
      {message && (
        <div className="rounded border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-3 py-2 text-sm text-slate-700 dark:text-foreground">
          {message}
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <div>
          <Label htmlFor="icd-category">Section</Label>
          <select
            id="icd-category"
            className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as (typeof ICD_CATEGORY_KEYS)[number])}
          >
            {ICD_CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="icd-label">Diagnosis Label</Label>
          <Input
            id="icd-label"
            className="mt-1"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Viral syndrome, unspecified"
          />
        </div>
        <div className="flex items-end">
          <Button disabled={saving} onClick={addCode}>
            {saving ? "Adding..." : "Add ICD-10"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 dark:border-border">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 dark:bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Diagnosis</th>
              <th className="px-3 py-2 text-left font-semibold">Section</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((row) => (
              <tr key={row.code} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-foreground">{row.code}</td>
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-muted-foreground">
                  {row.category_key && row.category_key in CATEGORY_LABELS
                    ? CATEGORY_LABELS[row.category_key as (typeof ICD_CATEGORY_KEYS)[number]]
                    : row.category_key || "Uncategorized"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500 dark:text-muted-foreground" colSpan={3}>
                  No ICD-10 catalog entries found yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
