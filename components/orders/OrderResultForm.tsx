"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { hasRolePermission } from "@/lib/roles";

interface OrderResultFormProps {
  order: {
    id: string;
    type: string;
    patient_id: string;
    details?: unknown;
  };
  existingResult?: {
    id: string;
    status: string;
    value: unknown;
    reported_at: string;
  };
  mode?: "result" | "note";
  onClose: () => void;
  onSaved: () => void;
}

interface LabTemplateField {
  key: string;
  label: string;
  unit?: string;
  placeholder?: string;
}

type RangeFlag = "normal" | "abnormal_low" | "abnormal_high" | "critical_low" | "critical_high" | "unknown";

interface RangeSpec {
  low?: number;
  high?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

interface LabTemplate {
  key: string;
  label: string;
  aliases: string[];
  fields: LabTemplateField[];
}

const LAB_RESULT_TEMPLATES: LabTemplate[] = [
  {
    key: "cbc",
    label: "CBC",
    aliases: ["cbc", "complete blood count"],
    fields: [
      { key: "wbc", label: "WBC", unit: "K/uL", placeholder: "4.0-11.0" },
      { key: "rbc", label: "RBC", unit: "M/uL", placeholder: "4.2-5.9" },
      { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL", placeholder: "12.0-17.5" },
      { key: "hematocrit", label: "Hematocrit", unit: "%", placeholder: "36-50" },
      { key: "platelets", label: "Platelets", unit: "K/uL", placeholder: "150-400" },
      { key: "mcv", label: "MCV", unit: "fL", placeholder: "80-100" },
      { key: "mch", label: "MCH", unit: "pg", placeholder: "27-33" },
      { key: "mchc", label: "MCHC", unit: "g/dL", placeholder: "32-36" },
      { key: "rdw", label: "RDW", unit: "%", placeholder: "11.5-14.5" },
      { key: "neutrophils", label: "Neutrophils", unit: "%", placeholder: "40-70" },
      { key: "lymphocytes", label: "Lymphocytes", unit: "%", placeholder: "20-45" },
      { key: "monocytes", label: "Monocytes", unit: "%", placeholder: "2-10" },
    ],
  },
  {
    key: "cmp",
    label: "CMP",
    aliases: ["cmp", "comprehensive metabolic panel"],
    fields: [
      { key: "sodium", label: "Sodium", unit: "mmol/L", placeholder: "135-145" },
      { key: "potassium", label: "Potassium", unit: "mmol/L", placeholder: "3.5-5.1" },
      { key: "chloride", label: "Chloride", unit: "mmol/L", placeholder: "98-107" },
      { key: "co2", label: "CO2", unit: "mmol/L", placeholder: "22-29" },
      { key: "bun", label: "BUN", unit: "mg/dL", placeholder: "7-20" },
      { key: "creatinine", label: "Creatinine", unit: "mg/dL", placeholder: "0.6-1.3" },
      { key: "glucose", label: "Glucose", unit: "mg/dL", placeholder: "70-110" },
      { key: "calcium", label: "Calcium", unit: "mg/dL", placeholder: "8.5-10.5" },
      { key: "total_protein", label: "Total Protein", unit: "g/dL", placeholder: "6.4-8.3" },
      { key: "albumin", label: "Albumin", unit: "g/dL", placeholder: "3.5-5.0" },
      { key: "ast", label: "AST", unit: "U/L", placeholder: "10-40" },
      { key: "alt", label: "ALT", unit: "U/L", placeholder: "7-56" },
      { key: "alk_phos", label: "Alk Phos", unit: "U/L", placeholder: "44-147" },
      { key: "bilirubin_total", label: "Total Bilirubin", unit: "mg/dL", placeholder: "0.1-1.2" },
    ],
  },
  {
    key: "bmp",
    label: "BMP",
    aliases: ["bmp", "basic metabolic panel"],
    fields: [
      { key: "sodium", label: "Sodium", unit: "mmol/L", placeholder: "135-145" },
      { key: "potassium", label: "Potassium", unit: "mmol/L", placeholder: "3.5-5.1" },
      { key: "chloride", label: "Chloride", unit: "mmol/L", placeholder: "98-107" },
      { key: "co2", label: "CO2", unit: "mmol/L", placeholder: "22-29" },
      { key: "bun", label: "BUN", unit: "mg/dL", placeholder: "7-20" },
      { key: "creatinine", label: "Creatinine", unit: "mg/dL", placeholder: "0.6-1.3" },
      { key: "glucose", label: "Glucose", unit: "mg/dL", placeholder: "70-110" },
      { key: "calcium", label: "Calcium", unit: "mg/dL", placeholder: "8.5-10.5" },
    ],
  },
  {
    key: "troponin",
    label: "Troponin",
    aliases: ["troponin", "trop", "troponin i", "troponin t"],
    fields: [
      { key: "troponin", label: "Troponin", unit: "ng/L", placeholder: "<14" },
      { key: "delta", label: "Delta (if serial)", unit: "ng/L", placeholder: "0-2 hr delta" },
    ],
  },
  {
    key: "lipase",
    label: "Lipase",
    aliases: ["lipase"],
    fields: [{ key: "lipase", label: "Lipase", unit: "U/L", placeholder: "13-60" }],
  },
  {
    key: "pt_inr_aptt",
    label: "PT / INR / aPTT",
    aliases: ["pt", "inr", "aptt", "a ptt", "coag", "coagulation panel"],
    fields: [
      { key: "pt", label: "PT", unit: "sec", placeholder: "11-13.5" },
      { key: "inr", label: "INR", unit: "", placeholder: "0.8-1.2" },
      { key: "aptt", label: "aPTT", unit: "sec", placeholder: "25-35" },
      { key: "fibrinogen", label: "Fibrinogen", unit: "mg/dL", placeholder: "200-400" },
      { key: "d_dimer", label: "D-Dimer", unit: "ng/mL FEU", placeholder: "<500" },
    ],
  },
  {
    key: "cardiac_enzymes",
    label: "Cardiac Enzymes",
    aliases: ["ck", "ck-mb", "ckmb", "cardiac enzymes", "enzyme panel"],
    fields: [
      { key: "troponin", label: "Troponin", unit: "ng/L", placeholder: "<14" },
      { key: "ck_total", label: "CK Total", unit: "U/L", placeholder: "30-200" },
      { key: "ck_mb", label: "CK-MB", unit: "ng/mL", placeholder: "0-5" },
      { key: "delta_troponin", label: "Delta Troponin", unit: "ng/L", placeholder: "Serial delta" },
    ],
  },
  {
    key: "bnp",
    label: "BNP / NT-proBNP",
    aliases: ["bnp", "nt-probnp", "ntprobnp"],
    fields: [
      { key: "bnp", label: "BNP", unit: "pg/mL", placeholder: "<100" },
      { key: "nt_probnp", label: "NT-proBNP", unit: "pg/mL", placeholder: "Age-adjusted" },
    ],
  },
  {
    key: "abg",
    label: "ABG",
    aliases: ["abg", "arterial blood gas"],
    fields: [
      { key: "ph", label: "pH", unit: "", placeholder: "7.35-7.45" },
      { key: "pco2", label: "pCO2", unit: "mmHg", placeholder: "35-45" },
      { key: "po2", label: "pO2", unit: "mmHg", placeholder: "80-100" },
      { key: "hco3", label: "HCO3", unit: "mmol/L", placeholder: "22-26" },
      { key: "base_excess", label: "Base Excess", unit: "mmol/L", placeholder: "-2 to +2" },
      { key: "o2_sat", label: "O2 Sat", unit: "%", placeholder: "95-100" },
      { key: "lactate", label: "Lactate", unit: "mmol/L", placeholder: "0.5-2.2" },
    ],
  },
  {
    key: "vbg",
    label: "VBG",
    aliases: ["vbg", "venous blood gas"],
    fields: [
      { key: "ph", label: "pH", unit: "", placeholder: "7.31-7.41" },
      { key: "pvco2", label: "pCO2", unit: "mmHg", placeholder: "41-51" },
      { key: "pvo2", label: "pO2", unit: "mmHg", placeholder: "30-40" },
      { key: "hco3", label: "HCO3", unit: "mmol/L", placeholder: "22-28" },
      { key: "base_excess", label: "Base Excess", unit: "mmol/L", placeholder: "-3 to +3" },
      { key: "venous_o2_sat", label: "Venous O2 Sat", unit: "%", placeholder: "60-80" },
      { key: "lactate", label: "Lactate", unit: "mmol/L", placeholder: "0.5-2.2" },
    ],
  },
  {
    key: "lactate",
    label: "Lactate",
    aliases: ["lactate", "serum lactate"],
    fields: [{ key: "lactate", label: "Lactate", unit: "mmol/L", placeholder: "0.5-2.2" }],
  },
  {
    key: "procalcitonin_crp_esr",
    label: "Inflammatory Markers",
    aliases: ["procalcitonin", "crp", "esr", "inflammatory marker"],
    fields: [
      { key: "procalcitonin", label: "Procalcitonin", unit: "ng/mL", placeholder: "<0.1" },
      { key: "crp", label: "CRP", unit: "mg/L", placeholder: "<10" },
      { key: "esr", label: "ESR", unit: "mm/hr", placeholder: "0-20" },
    ],
  },
  {
    key: "electrolyte_extended",
    label: "Extended Electrolytes",
    aliases: ["magnesium", "phosphorus", "ionized calcium", "osmolality", "electrolyte"],
    fields: [
      { key: "magnesium", label: "Magnesium", unit: "mg/dL", placeholder: "1.7-2.2" },
      { key: "phosphorus", label: "Phosphorus", unit: "mg/dL", placeholder: "2.5-4.5" },
      { key: "ionized_calcium", label: "Ionized Calcium", unit: "mmol/L", placeholder: "1.12-1.32" },
      { key: "serum_osmolality", label: "Serum Osmolality", unit: "mOsm/kg", placeholder: "275-295" },
    ],
  },
  {
    key: "lft",
    label: "LFT Panel",
    aliases: ["lft", "liver function", "hepatic panel"],
    fields: [
      { key: "ast", label: "AST", unit: "U/L", placeholder: "10-40" },
      { key: "alt", label: "ALT", unit: "U/L", placeholder: "7-56" },
      { key: "alk_phos", label: "Alk Phos", unit: "U/L", placeholder: "44-147" },
      { key: "bilirubin_total", label: "Total Bilirubin", unit: "mg/dL", placeholder: "0.1-1.2" },
      { key: "bilirubin_direct", label: "Direct Bilirubin", unit: "mg/dL", placeholder: "0-0.3" },
      { key: "albumin", label: "Albumin", unit: "g/dL", placeholder: "3.5-5.0" },
      { key: "total_protein", label: "Total Protein", unit: "g/dL", placeholder: "6.4-8.3" },
    ],
  },
  {
    key: "amylase",
    label: "Amylase",
    aliases: ["amylase"],
    fields: [{ key: "amylase", label: "Amylase", unit: "U/L", placeholder: "30-110" }],
  },
  {
    key: "hba1c",
    label: "HbA1c",
    aliases: ["a1c", "hba1c", "hemoglobin a1c"],
    fields: [{ key: "hba1c", label: "HbA1c", unit: "%", placeholder: "4.0-5.6" }],
  },
  {
    key: "ketones",
    label: "Ketone Panel",
    aliases: ["beta-hydroxybutyrate", "ketone", "serum ketone"],
    fields: [
      { key: "beta_hydroxybutyrate", label: "Beta-Hydroxybutyrate", unit: "mmol/L", placeholder: "<0.6" },
      { key: "serum_ketones", label: "Serum Ketones", unit: "", placeholder: "Negative/Trace/Positive" },
    ],
  },
  {
    key: "retic",
    label: "Reticulocyte Count",
    aliases: ["retic", "reticulocyte"],
    fields: [
      { key: "retic_percent", label: "Retic %", unit: "%", placeholder: "0.5-2.5" },
      { key: "retic_absolute", label: "Retic Absolute", unit: "K/uL", placeholder: "25-100" },
    ],
  },
  {
    key: "iron_studies",
    label: "Iron Studies",
    aliases: ["iron studies", "ferritin", "tibc", "transferrin saturation"],
    fields: [
      { key: "serum_iron", label: "Serum Iron", unit: "ug/dL", placeholder: "60-170" },
      { key: "ferritin", label: "Ferritin", unit: "ng/mL", placeholder: "30-400" },
      { key: "tibc", label: "TIBC", unit: "ug/dL", placeholder: "240-450" },
      { key: "transferrin_sat", label: "Transferrin Sat", unit: "%", placeholder: "20-50" },
    ],
  },
  {
    key: "urinalysis",
    label: "Urinalysis with Microscopy",
    aliases: ["urinalysis", "ua", "ua w", "urine micro", "ua/micro"],
    fields: [
      { key: "color", label: "Color", placeholder: "Yellow" },
      { key: "clarity", label: "Clarity", placeholder: "Clear/Cloudy" },
      { key: "specific_gravity", label: "Specific Gravity", placeholder: "1.005-1.030" },
      { key: "ph", label: "pH", placeholder: "5.0-8.0" },
      { key: "protein", label: "Protein", placeholder: "Negative/Trace/1+" },
      { key: "glucose", label: "Glucose", placeholder: "Negative" },
      { key: "ketones", label: "Ketones", placeholder: "Negative/Trace/Positive" },
      { key: "blood", label: "Blood", placeholder: "Negative/Positive" },
      { key: "nitrite", label: "Nitrite", placeholder: "Negative/Positive" },
      { key: "leukocyte_esterase", label: "Leukocyte Esterase", placeholder: "Negative/Positive" },
      { key: "wbc_hpf", label: "WBC / HPF", placeholder: "0-5" },
      { key: "rbc_hpf", label: "RBC / HPF", placeholder: "0-2" },
      { key: "bacteria", label: "Bacteria", placeholder: "None/Few/Many" },
    ],
  },
  {
    key: "urine_culture",
    label: "Urine Culture",
    aliases: ["urine culture", "ucx"],
    fields: [
      { key: "organism", label: "Organism", placeholder: "E. coli / no growth" },
      { key: "colony_count", label: "Colony Count", unit: "CFU/mL", placeholder: "e.g. >100000" },
      { key: "susceptibility_summary", label: "Susceptibility Summary", placeholder: "Sensitive/Resistant pattern" },
    ],
  },
  {
    key: "urine_protein_creatinine",
    label: "Urine Protein/Creatinine Ratio",
    aliases: ["upcr", "urine protein creatinine", "protein/creatinine ratio"],
    fields: [
      { key: "urine_protein", label: "Urine Protein", unit: "mg/dL", placeholder: "" },
      { key: "urine_creatinine", label: "Urine Creatinine", unit: "mg/dL", placeholder: "" },
      { key: "ratio", label: "Protein/Creatinine Ratio", unit: "", placeholder: "<0.2" },
    ],
  },
  {
    key: "toxicology",
    label: "Toxicology / Drug Screen",
    aliases: ["uds", "drug screen", "toxicology", "tox", "ethanol", "acetaminophen level", "salicylate"],
    fields: [
      { key: "ethanol", label: "Ethanol", unit: "mg/dL", placeholder: "<10" },
      { key: "acetaminophen_level", label: "Acetaminophen Level", unit: "ug/mL", placeholder: "" },
      { key: "salicylate_level", label: "Salicylate Level", unit: "mg/dL", placeholder: "" },
      { key: "opiates", label: "Opiates", placeholder: "Negative/Positive" },
      { key: "benzodiazepines", label: "Benzodiazepines", placeholder: "Negative/Positive" },
      { key: "cocaine", label: "Cocaine", placeholder: "Negative/Positive" },
      { key: "amphetamines", label: "Amphetamines", placeholder: "Negative/Positive" },
      { key: "thc", label: "THC", placeholder: "Negative/Positive" },
      { key: "fentanyl", label: "Fentanyl", placeholder: "Negative/Positive" },
    ],
  },
  {
    key: "blood_culture",
    label: "Blood Cultures x2",
    aliases: ["blood culture", "blood cultures x2", "bcx"],
    fields: [
      { key: "set_1", label: "Set 1", placeholder: "No growth / organism identified" },
      { key: "set_2", label: "Set 2", placeholder: "No growth / organism identified" },
      { key: "gram_stain", label: "Gram Stain", placeholder: "GPC/GNR/None seen" },
      { key: "time_to_positivity", label: "Time to Positivity", unit: "hours", placeholder: "" },
    ],
  },
  {
    key: "respiratory_viral_panel",
    label: "Respiratory Viral Panel",
    aliases: ["rvp", "respiratory viral panel", "covid flu rsv", "flu/rsv", "covid pcr"],
    fields: [
      { key: "sars_cov_2", label: "SARS-CoV-2", placeholder: "Detected/Not detected" },
      { key: "influenza_a", label: "Influenza A", placeholder: "Detected/Not detected" },
      { key: "influenza_b", label: "Influenza B", placeholder: "Detected/Not detected" },
      { key: "rsv", label: "RSV", placeholder: "Detected/Not detected" },
      { key: "other_viruses", label: "Other Viruses", placeholder: "Optional details" },
    ],
  },
  {
    key: "rapid_strep",
    label: "Rapid Strep",
    aliases: ["rapid strep", "strep ag", "group a strep"],
    fields: [
      { key: "rapid_strep", label: "Rapid Strep", placeholder: "Positive/Negative" },
      { key: "throat_culture", label: "Throat Culture", placeholder: "If reflexed" },
    ],
  },
  {
    key: "thyroid",
    label: "Thyroid Panel (TSH/Free T4)",
    aliases: ["tsh", "free t4", "thyroid panel"],
    fields: [
      { key: "tsh", label: "TSH", unit: "uIU/mL", placeholder: "0.4-4.0" },
      { key: "free_t4", label: "Free T4", unit: "ng/dL", placeholder: "0.8-1.8" },
    ],
  },
  {
    key: "cortisol",
    label: "Cortisol",
    aliases: ["cortisol"],
    fields: [{ key: "cortisol", label: "Cortisol", unit: "ug/dL", placeholder: "AM/PM reference dependent" }],
  },
  {
    key: "hcg_quant",
    label: "hCG Quantitative",
    aliases: ["hcg", "beta hcg", "quant hcg", "hcg quantitative"],
    fields: [{ key: "beta_hcg", label: "Beta-hCG", unit: "mIU/mL", placeholder: "Pregnancy dependent" }],
  },
  {
    key: "type_screen_crossmatch",
    label: "Type/Screen/Crossmatch",
    aliases: ["type and screen", "type/screen", "crossmatch", "abo/rh", "antibody screen"],
    fields: [
      { key: "abo", label: "ABO Group", placeholder: "A/B/AB/O" },
      { key: "rh", label: "Rh", placeholder: "Positive/Negative" },
      { key: "antibody_screen", label: "Antibody Screen", placeholder: "Positive/Negative" },
      { key: "crossmatch", label: "Crossmatch", placeholder: "Compatible/Incompatible" },
    ],
  },
  {
    key: "csf_panel",
    label: "CSF Panel",
    aliases: ["csf", "lumbar puncture", "csf studies", "spinal fluid"],
    fields: [
      { key: "opening_pressure", label: "Opening Pressure", unit: "cmH2O", placeholder: "6-20" },
      { key: "wbc", label: "WBC", unit: "/uL", placeholder: "0-5" },
      { key: "rbc", label: "RBC", unit: "/uL", placeholder: "0" },
      { key: "protein", label: "Protein", unit: "mg/dL", placeholder: "15-45" },
      { key: "glucose", label: "Glucose", unit: "mg/dL", placeholder: "40-70" },
      { key: "gram_stain", label: "Gram Stain", placeholder: "Organisms seen/not seen" },
      { key: "culture", label: "Culture", placeholder: "No growth / organism identified" },
    ],
  },
  {
    key: "stool_occult_blood",
    label: "Stool Occult Blood",
    aliases: ["stool occult blood", "fit", "fobt", "guaiac"],
    fields: [{ key: "occult_blood", label: "Occult Blood", placeholder: "Positive/Negative" }],
  },
];

const ANALYTE_RANGES: Record<string, RangeSpec> = {
  wbc: { low: 4, high: 11, criticalLow: 2, criticalHigh: 30 },
  hemoglobin: { low: 12, high: 17.5, criticalLow: 7, criticalHigh: 20 },
  platelets: { low: 150, high: 400, criticalLow: 50, criticalHigh: 1000 },
  sodium: { low: 135, high: 145, criticalLow: 120, criticalHigh: 160 },
  potassium: { low: 3.5, high: 5.1, criticalLow: 2.8, criticalHigh: 6.2 },
  glucose: { low: 70, high: 110, criticalLow: 50, criticalHigh: 400 },
  creatinine: { low: 0.6, high: 1.3, criticalHigh: 4 },
  troponin: { high: 14, criticalHigh: 52 },
  lactate: { low: 0.5, high: 2.2, criticalHigh: 4 },
  ph: { low: 7.35, high: 7.45, criticalLow: 7.2, criticalHigh: 7.6 },
  pco2: { low: 35, high: 45, criticalLow: 20, criticalHigh: 70 },
  po2: { low: 80, high: 100, criticalLow: 55 },
  o2_sat: { low: 95, high: 100, criticalLow: 85 },
};

function extractLabTestName(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") return details;
  if (typeof details === "object" && !Array.isArray(details)) {
    const record = details as Record<string, unknown>;
    const test = record.test;
    const panel = record.panel;
    const note = record.note;
    if (typeof test === "string") return test;
    if (typeof panel === "string") return panel;
    if (typeof note === "string") return note;
  }
  return "";
}

function detectLabTemplateKey(testName: string): string {
  const normalized = testName.trim().toLowerCase();
  if (!normalized) return "";
  const matched = LAB_RESULT_TEMPLATES.find((template) =>
    template.aliases.some((alias) => normalized.includes(alias))
  );
  return matched?.key || "";
}

function parseNumeric(value: string): number | null {
  if (!value.trim()) return null;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

function getRangeFlag(value: string, spec?: RangeSpec): RangeFlag {
  const num = parseNumeric(value);
  if (num === null || !spec) return "unknown";
  if (typeof spec.criticalLow === "number" && num < spec.criticalLow) return "critical_low";
  if (typeof spec.criticalHigh === "number" && num > spec.criticalHigh) return "critical_high";
  if (typeof spec.low === "number" && num < spec.low) return "abnormal_low";
  if (typeof spec.high === "number" && num > spec.high) return "abnormal_high";
  return "normal";
}

function flagLabel(flag: RangeFlag): string {
  switch (flag) {
    case "critical_low":
      return "Critical Low";
    case "critical_high":
      return "Critical High";
    case "abnormal_low":
      return "Low";
    case "abnormal_high":
      return "High";
    case "normal":
      return "Normal";
    default:
      return "Unrated";
  }
}

export function OrderResultForm({
  order,
  existingResult,
  mode = "result",
  onClose,
  onSaved,
}: OrderResultFormProps) {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };
  const valueRecord = asRecord(existingResult?.value);
  const isProcedureNoteMode = mode === "note" && order.type === "procedure";
  const isLabResultMode = mode === "result" && order.type === "lab";
  const modalMaxWidthClass = isProcedureNoteMode ? "max-w-3xl" : "max-w-xl";
  const detectedLabTemplateKey = useMemo(
    () => detectLabTemplateKey(extractLabTestName(order.details)),
    [order.details]
  );

  const [status, setStatus] = useState(existingResult?.status || "preliminary");
  const [valueInput, setValueInput] = useState(
    existingResult?.value
      ? typeof existingResult.value === "string"
        ? existingResult.value
        : JSON.stringify(existingResult.value, null, 2)
      : ""
  );
  const [procedureName, setProcedureName] = useState(
    typeof valueRecord?.procedure_name === "string" ? valueRecord.procedure_name : ""
  );
  const [preOpDiagnosis, setPreOpDiagnosis] = useState(
    typeof valueRecord?.pre_op_diagnosis === "string"
      ? valueRecord.pre_op_diagnosis
      : ""
  );
  const [postOpDiagnosis, setPostOpDiagnosis] = useState(
    typeof valueRecord?.post_op_diagnosis === "string"
      ? valueRecord.post_op_diagnosis
      : ""
  );
  const [indication, setIndication] = useState(
    typeof valueRecord?.indication === "string" ? valueRecord.indication : ""
  );
  const [anesthesia, setAnesthesia] = useState(
    typeof valueRecord?.anesthesia === "string" ? valueRecord.anesthesia : ""
  );
  const [findings, setFindings] = useState(
    typeof valueRecord?.findings === "string" ? valueRecord.findings : ""
  );
  const [technique, setTechnique] = useState(
    typeof valueRecord?.technique === "string"
      ? valueRecord.technique
      : typeof valueRecord?.note === "string"
      ? valueRecord.note
      : ""
  );
  const [complications, setComplications] = useState(
    typeof valueRecord?.complications === "string"
      ? valueRecord.complications
      : "None."
  );
  const [estimatedBloodLoss, setEstimatedBloodLoss] = useState(
    typeof valueRecord?.estimated_blood_loss === "string"
      ? valueRecord.estimated_blood_loss
      : ""
  );
  const [specimens, setSpecimens] = useState(
    typeof valueRecord?.specimens === "string" ? valueRecord.specimens : ""
  );
  const [disposition, setDisposition] = useState(
    typeof valueRecord?.disposition === "string" ? valueRecord.disposition : ""
  );
  const [plan, setPlan] = useState(
    typeof valueRecord?.plan === "string" ? valueRecord.plan : ""
  );
  const [consentObtained, setConsentObtained] = useState(
    typeof valueRecord?.consent_obtained === "boolean" ? valueRecord.consent_obtained : false
  );
  const [timeOutCompleted, setTimeOutCompleted] = useState(
    typeof valueRecord?.time_out_completed === "boolean"
      ? valueRecord.time_out_completed
      : false
  );
  const [performer, setPerformer] = useState(
    typeof valueRecord?.performer === "string" ? valueRecord.performer : ""
  );
  const [assistant, setAssistant] = useState(
    typeof valueRecord?.assistant === "string" ? valueRecord.assistant : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCritical, setIsCritical] = useState(
    typeof valueRecord?.is_critical === "boolean" ? valueRecord.is_critical : false
  );
  const [criticalReason, setCriticalReason] = useState(
    typeof valueRecord?.critical_reason === "string" ? valueRecord.critical_reason : ""
  );
  const [labTemplateKey, setLabTemplateKey] = useState(() => {
    if (typeof valueRecord?.format === "string" && valueRecord.format === "lab_panel_v1") {
      return typeof valueRecord?.panel === "string" ? valueRecord.panel : detectedLabTemplateKey;
    }
    return detectedLabTemplateKey;
  });
  const [labComments, setLabComments] = useState(
    typeof valueRecord?.comments === "string" ? valueRecord.comments : ""
  );
  const [labFieldValues, setLabFieldValues] = useState<Record<string, string>>(() => {
    const stored =
      valueRecord && typeof valueRecord.values === "object" && valueRecord.values !== null
        ? (valueRecord.values as Record<string, unknown>)
        : null;
    if (!stored) return {};
    return Object.fromEntries(
      Object.entries(stored).map(([key, value]) => [key, typeof value === "string" ? value : ""])
    );
  });
  const selectedLabTemplate = useMemo(
    () => LAB_RESULT_TEMPLATES.find((template) => template.key === labTemplateKey) || null,
    [labTemplateKey]
  );
  const [criticalCallbackDocumented, setCriticalCallbackDocumented] = useState(false);
  const [criticalCallbackNote, setCriticalCallbackNote] = useState("");

  const labFieldFlags = useMemo(() => {
    if (!selectedLabTemplate) return {};
    return Object.fromEntries(
      selectedLabTemplate.fields.map((field) => [
        field.key,
        getRangeFlag(labFieldValues[field.key] || "", ANALYTE_RANGES[field.key]),
      ])
    ) as Record<string, RangeFlag>;
  }, [selectedLabTemplate, labFieldValues]);

  const hasCriticalLabFlag = useMemo(() => {
    return Object.values(labFieldFlags).some(
      (flag) => flag === "critical_low" || flag === "critical_high"
    );
  }, [labFieldFlags]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };

    let parsedValue: Record<string, unknown> = {};
    if (isProcedureNoteMode) {
      if (!procedureName.trim()) {
        setError("Procedure name is required.");
        setSaving(false);
        return;
      }
      if (!postOpDiagnosis.trim()) {
        setError("Post-op diagnosis is required.");
        setSaving(false);
        return;
      }
      if (!technique.trim()) {
        setError("Procedure narrative/technique is required.");
        setSaving(false);
        return;
      }
      if (status === "final") {
        if (!consentObtained || !timeOutCompleted || !performer.trim()) {
          setError("Consent, time-out, and performer are required before finalizing.");
          setSaving(false);
          return;
        }
        if (!hasRolePermission(profile?.role, "finalize_procedure_note")) {
          setError("Your role cannot finalize procedure notes.");
          setSaving(false);
          return;
        }
      }

      parsedValue = {
        format: "procedure_note_v1",
        procedure_name: procedureName.trim(),
        pre_op_diagnosis: preOpDiagnosis.trim() || null,
        post_op_diagnosis: postOpDiagnosis.trim(),
        indication: indication.trim() || null,
        anesthesia: anesthesia.trim() || null,
        findings: findings.trim() || null,
        technique: technique.trim(),
        complications: complications.trim() || "None.",
        estimated_blood_loss: estimatedBloodLoss.trim() || null,
        specimens: specimens.trim() || null,
        disposition: disposition.trim() || null,
        plan: plan.trim() || null,
        consent_obtained: consentObtained,
        time_out_completed: timeOutCompleted,
        performer: performer.trim() || null,
        assistant: assistant.trim() || null,
      };
    } else if (isLabResultMode && selectedLabTemplate) {
      const values = selectedLabTemplate.fields.reduce<Record<string, string>>((acc, field) => {
        const currentValue = (labFieldValues[field.key] || "").trim();
        if (currentValue) {
          acc[field.key] = currentValue;
        }
        return acc;
      }, {});
      const hasAtLeastOneValue = Object.keys(values).length > 0;
      if (!hasAtLeastOneValue) {
        setError("Enter at least one lab value before saving.");
        setSaving(false);
        return;
      }
      const flags = Object.fromEntries(
        Object.keys(values).map((key) => [key, labFieldFlags[key] || "unknown"])
      );
      parsedValue = {
        format: "lab_panel_v1",
        panel: selectedLabTemplate.key,
        panel_label: selectedLabTemplate.label,
        values,
        flags,
        comments: labComments.trim() || null,
      };
    } else {
      try {
        if (valueInput.trim()) {
          parsedValue = JSON.parse(valueInput) as Record<string, unknown>;
        } else {
          parsedValue = { note: "" };
        }
      } catch {
        parsedValue = { note: valueInput };
      }
    }

    const payload = {
      order_id: order.id,
      patient_id: order.patient_id,
      type: order.type,
      value: parsedValue,
      status,
      is_critical: mode === "result" ? isCritical || hasCriticalLabFlag : false,
      critical_reason:
        mode === "result" && (isCritical || hasCriticalLabFlag)
          ? criticalReason.trim() || (hasCriticalLabFlag ? "Auto-flagged critical analyte value." : null)
          : null,
      critical_callback_documented:
        mode === "result" && (isCritical || hasCriticalLabFlag)
          ? criticalCallbackDocumented
          : false,
      critical_callback_documented_at:
        mode === "result" && (isCritical || hasCriticalLabFlag) && criticalCallbackDocumented
          ? new Date().toISOString()
          : null,
      critical_callback_documented_by: criticalCallbackDocumented ? user?.id ?? null : null,
      critical_callback_documented_by_name:
        criticalCallbackDocumented && user ? user.email || "Clinician" : null,
      reviewed_note:
        mode === "result" && criticalCallbackNote.trim() ? criticalCallbackNote.trim() : null,
      reported_at: new Date().toISOString(),
    };

    const { error: insertError } = existingResult?.id
      ? await supabase.from("results").update(payload).eq("id", existingResult.id)
      : await supabase.from("results").insert(payload);

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("orders")
      .update({
        status: mode === "result" && status !== "final" ? "pending" : "completed",
      })
      .eq("id", order.id);

    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
      <Card className={`mx-auto my-4 flex w-full ${modalMaxWidthClass} max-h-[92vh] flex-col`}>
        <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b border-slate-200 pb-3">
          <CardTitle>
            {mode === "note"
              ? order.type === "procedure"
                ? `${existingResult ? "Update" : "Add"} Procedure Note`
                : `${existingResult ? "Update" : "Add"} ${order.type} Note`
              : `${existingResult ? "Update" : "Enter"} ${order.type} Result`}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          <form onSubmit={handleSave} className="space-y-4 p-6">
            <div>
              <Label>{mode === "note" ? "Entry Status" : "Result Status"}</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
              >
                {mode === "result" && <option value="pending">Pending</option>}
                <option value="preliminary">Preliminary</option>
                <option value="final">Final</option>
              </select>
            </div>
            {isProcedureNoteMode ? (
              <div className="space-y-3 rounded border border-slate-200 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Procedure Performed</Label>
                    <Input
                      className="mt-1"
                      value={procedureName}
                      onChange={(e) => setProcedureName(e.target.value)}
                      placeholder="e.g. Laceration repair, simple"
                    />
                  </div>
                  <div>
                    <Label>Anesthesia</Label>
                    <Input
                      className="mt-1"
                      value={anesthesia}
                      onChange={(e) => setAnesthesia(e.target.value)}
                      placeholder="e.g. Local 1% lidocaine"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Performer</Label>
                    <Input
                      className="mt-1"
                      value={performer}
                      onChange={(e) => setPerformer(e.target.value)}
                      placeholder="Primary operator"
                    />
                  </div>
                  <div>
                    <Label>Assistant</Label>
                    <Input
                      className="mt-1"
                      value={assistant}
                      onChange={(e) => setAssistant(e.target.value)}
                      placeholder="Assistant clinician"
                    />
                  </div>
                </div>

                <div className="rounded border border-slate-200 p-2">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Procedure Safety Checklist
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={consentObtained}
                      onChange={(e) => setConsentObtained(e.target.checked)}
                    />
                    Consent obtained
                  </label>
                  <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={timeOutCompleted}
                      onChange={(e) => setTimeOutCompleted(e.target.checked)}
                    />
                    Time-out completed
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Pre-op Diagnosis</Label>
                    <Input
                      className="mt-1"
                      value={preOpDiagnosis}
                      onChange={(e) => setPreOpDiagnosis(e.target.value)}
                      placeholder="Diagnosis before procedure"
                    />
                  </div>
                  <div>
                    <Label>Post-op Diagnosis</Label>
                    <Input
                      className="mt-1"
                      value={postOpDiagnosis}
                      onChange={(e) => setPostOpDiagnosis(e.target.value)}
                      placeholder="Diagnosis after procedure"
                    />
                  </div>
                </div>

                <div>
                  <Label>Indication</Label>
                  <Textarea
                    className="mt-1 min-h-[70px]"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="Clinical indication/medical necessity."
                  />
                </div>

                <div>
                  <Label>Procedure Narrative / Technique</Label>
                  <Textarea
                    className="mt-1 min-h-[120px]"
                    value={technique}
                    onChange={(e) => setTechnique(e.target.value)}
                    placeholder="Step-by-step narrative of how the procedure was performed."
                  />
                </div>

                <div>
                  <Label>Findings</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    placeholder="Relevant findings during procedure."
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Complications</Label>
                    <Input
                      className="mt-1"
                      value={complications}
                      onChange={(e) => setComplications(e.target.value)}
                      placeholder="None."
                    />
                  </div>
                  <div>
                    <Label>Estimated Blood Loss</Label>
                    <Input
                      className="mt-1"
                      value={estimatedBloodLoss}
                      onChange={(e) => setEstimatedBloodLoss(e.target.value)}
                      placeholder="e.g. <10 mL"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Specimens</Label>
                    <Input
                      className="mt-1"
                      value={specimens}
                      onChange={(e) => setSpecimens(e.target.value)}
                      placeholder="Specimens collected/sent."
                    />
                  </div>
                  <div>
                    <Label>Disposition</Label>
                    <Input
                      className="mt-1"
                      value={disposition}
                      onChange={(e) => setDisposition(e.target.value)}
                      placeholder="e.g. Tolerated well, stable to recovery."
                    />
                  </div>
                </div>

                <div>
                  <Label>Post-Procedure Plan</Label>
                  <Textarea
                    className="mt-1 min-h-[80px]"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    placeholder="Follow-up instructions and next steps."
                  />
                </div>
              </div>
            ) : isLabResultMode ? (
              <div className="space-y-3 rounded border border-slate-200 p-3">
                <div>
                  <Label>Lab Result Template</Label>
                  <select
                    value={labTemplateKey}
                    onChange={(e) => setLabTemplateKey(e.target.value)}
                    className="mt-1 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">No template (JSON/text)</option>
                    {LAB_RESULT_TEMPLATES.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedLabTemplate ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedLabTemplate.fields.map((field) => (
                        <div key={field.key}>
                          <Label>
                            {field.label}
                            {field.unit ? ` (${field.unit})` : ""}
                          </Label>
                          <Input
                            className="mt-1"
                            value={labFieldValues[field.key] || ""}
                            onChange={(e) =>
                              setLabFieldValues((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder={field.placeholder || ""}
                          />
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">
                              Ref: {field.placeholder || "custom"}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 ${
                                labFieldFlags[field.key] === "normal"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : labFieldFlags[field.key] === "critical_low" ||
                                    labFieldFlags[field.key] === "critical_high"
                                  ? "bg-red-50 text-red-700"
                                  : labFieldFlags[field.key] === "abnormal_low" ||
                                    labFieldFlags[field.key] === "abnormal_high"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {flagLabel(labFieldFlags[field.key] || "unknown")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label>Comments / Interpretation</Label>
                      <Textarea
                        className="mt-1 min-h-[80px]"
                        value={labComments}
                        onChange={(e) => setLabComments(e.target.value)}
                        placeholder="Additional context, significant abnormalities, trend notes."
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <Label>Result Value (JSON or text)</Label>
                    <Textarea
                      className="mt-1 min-h-[140px]"
                      placeholder='e.g. {"finding":"No acute cardiopulmonary abnormality","impression":"Normal chest X-ray"}'
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Label>
                  {mode === "note"
                    ? "Clinical Note (JSON or text)"
                    : "Result Value (JSON or text)"}
                </Label>
                <Textarea
                  className="mt-1 min-h-[140px]"
                  placeholder={
                    mode === "note"
                      ? 'e.g. "Medication administered without adverse reaction"'
                      : 'e.g. {"finding":"No acute cardiopulmonary abnormality","impression":"Normal chest X-ray"}'
                  }
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                />
              </div>
            )}
            {mode === "result" && (
              <div className="rounded border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isCritical}
                    onChange={(e) => setIsCritical(e.target.checked)}
                  />
                  Mark as critical result
                </label>
                {isCritical && (
                  <div className="mt-2">
                    <Label>Critical Reason</Label>
                    <Input
                      className="mt-1"
                      value={criticalReason}
                      onChange={(e) => setCriticalReason(e.target.value)}
                      placeholder="Why this result is urgent/critical"
                    />
                  </div>
                )}
                {(isCritical || hasCriticalLabFlag) && (
                  <div className="mt-2 space-y-2 rounded border border-red-200 bg-red-50/50 p-2">
                    <label className="flex items-center gap-2 text-sm text-red-800">
                      <input
                        type="checkbox"
                        checked={criticalCallbackDocumented}
                        onChange={(e) => setCriticalCallbackDocumented(e.target.checked)}
                      />
                      Critical callback documented
                    </label>
                    <div>
                      <Label>Callback / Escalation Note</Label>
                      <Textarea
                        className="mt-1 min-h-[60px]"
                        value={criticalCallbackNote}
                        onChange={(e) => setCriticalCallbackNote(e.target.value)}
                        placeholder="Who was notified, time, and action taken."
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="sticky bottom-0 z-10 -mx-6 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : mode === "note" ? "Save Note" : "Save Result"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
