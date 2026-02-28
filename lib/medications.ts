export type MedicationCategory =
  | "all"
  | "analgesics"
  | "antibiotics"
  | "cardiovascular"
  | "respiratory"
  | "endocrine"
  | "gi"
  | "neuro_psych"
  | "critical_care"
  | "anticoagulation"
  | "obgyn"
  | "renal_urology"
  | "infectious_antiviral"
  | "iv_fluids"
  | "misc";

export interface MedicationItem {
  name: string;
  aliases?: string[];
  category: Exclude<MedicationCategory, "all">;
  controlled: boolean;
  defaultRoute?: string;
  defaultFrequency?: string;
}

export const MEDICATION_CATEGORY_LABELS: Record<MedicationCategory, string> = {
  all: "All",
  analgesics: "Pain / Sedation",
  antibiotics: "Antibiotics",
  cardiovascular: "Cardiovascular",
  respiratory: "Respiratory",
  endocrine: "Endocrine / Metabolic",
  gi: "GI / Hepatic",
  neuro_psych: "Neuro / Psych",
  critical_care: "Critical Care / ED",
  anticoagulation: "Anticoagulation / Hematology",
  obgyn: "OB/GYN",
  renal_urology: "Renal / Urology",
  infectious_antiviral: "Antiviral / ID Adjuncts",
  iv_fluids: "IV Fluids",
  misc: "Other",
};

export const MEDICATION_CATEGORIES: MedicationCategory[] = [
  "all",
  "analgesics",
  "antibiotics",
  "cardiovascular",
  "respiratory",
  "endocrine",
  "gi",
  "neuro_psych",
  "critical_care",
  "anticoagulation",
  "obgyn",
  "renal_urology",
  "infectious_antiviral",
  "iv_fluids",
  "misc",
];

/** Deduplicated formulary: first occurrence per name wins. Use this for picker/search to avoid duplicates. */
function deduplicateFormulary(items: MedicationItem[]): MedicationItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Token-based medication search. Splits query into tokens; each token must match name or any alias.
 * Returns items sorted by: favorites first, then relevance (exact > prefix > contains), then name.
 */
export function searchMedications(
  formulary: MedicationItem[],
  query: string,
  category: MedicationCategory,
  favorites: string[],
): MedicationItem[] {
  const q = query.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  let source = formulary;
  if (category !== "all") {
    source = formulary.filter((m) => m.category === category);
  }

  if (tokens.length === 0) {
    return [...source].sort((a, b) => {
      const af = favorites.includes(a.name) ? 1 : 0;
      const bf = favorites.includes(b.name) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name);
    });
  }

  const matchScore = (med: MedicationItem): number => {
    const name = med.name.toLowerCase();
    const aliases = (med.aliases ?? []).map((a) => String(a).toLowerCase());
    const allText = [name, ...aliases];
    const tokenScores = tokens.map((token) => {
      for (let i = 0; i < allText.length; i++) {
        const t = allText[i];
        if (t === token) return 100;
        if (t.startsWith(token)) return 50;
        if (t.includes(token)) return 10;
      }
      return 0;
    });
    const minScore = Math.min(...tokenScores);
    if (minScore === 0) return -1;
    return tokenScores.reduce<number>((a, b) => a + b, 0);
  };

  const filtered = source.filter((med) => matchScore(med) >= 0);
  return filtered.sort((a, b) => {
    const af = favorites.includes(a.name) ? 1 : 0;
    const bf = favorites.includes(b.name) ? 1 : 0;
    if (af !== bf) return bf - af;
    const sa = matchScore(a);
    const sb = matchScore(b);
    if (sa !== sb) return sb - sa;
    return a.name.localeCompare(b.name);
  });
}

// Large curated formulary for realistic simulation UX.
// This is intentionally broad, but can be expanded further over time.
export const MEDICATION_FORMULARY: MedicationItem[] = [
  { name: "Acetaminophen", aliases: ["Tylenol"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Ibuprofen", aliases: ["Motrin", "Advil"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Q8H PRN" },
  { name: "Naproxen", aliases: ["Aleve"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID PRN" },
  { name: "Ketorolac", aliases: ["Toradol"], category: "analgesics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Diclofenac", aliases: ["Voltaren"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Meloxicam", aliases: ["Mobic"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Celecoxib", aliases: ["Celebrex"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Lidocaine Patch", aliases: ["Lidoderm"], category: "analgesics", controlled: false, defaultRoute: "Topical", defaultFrequency: "Daily" },
  { name: "Tramadol", aliases: ["Ultram"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Codeine", aliases: ["Tylenol #3"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q4H PRN" },
  { name: "Hydrocodone/Acetaminophen", aliases: ["Norco"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Oxycodone", aliases: ["Roxicodone"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Oxycodone/Acetaminophen", aliases: ["Percocet"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Morphine", aliases: ["MS Contin"], category: "analgesics", controlled: true, defaultRoute: "IV", defaultFrequency: "Q4H PRN" },
  { name: "Hydromorphone", aliases: ["Dilaudid"], category: "analgesics", controlled: true, defaultRoute: "IV", defaultFrequency: "Q4H PRN" },
  { name: "Fentanyl", aliases: ["Sublimaze"], category: "analgesics", controlled: true, defaultRoute: "IV", defaultFrequency: "Q1H PRN" },
  { name: "Methadone", aliases: ["Dolophine"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q8H" },
  { name: "Buprenorphine", aliases: ["Subutex"], category: "analgesics", controlled: true, defaultRoute: "SL", defaultFrequency: "Daily" },
  { name: "Cyclobenzaprine", aliases: ["Flexeril"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "TID PRN" },
  { name: "Methocarbamol", aliases: ["Robaxin"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "QID PRN" },

  { name: "Amoxicillin", aliases: ["Amoxil"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Amoxicillin/Clavulanate", aliases: ["Augmentin"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Penicillin VK", aliases: ["Pen-VK"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "QID" },
  { name: "Ampicillin", category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H" },
  { name: "Piperacillin/Tazobactam", aliases: ["Zosyn"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H" },
  { name: "Cefazolin", aliases: ["Ancef"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Cephalexin", aliases: ["Keflex"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "QID" },
  { name: "Ceftriaxone", aliases: ["Rocephin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q24H" },
  { name: "Cefepime", aliases: ["Maxipime"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Ceftazidime", aliases: ["Fortaz"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Cefdinir", aliases: ["Omnicef"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Azithromycin", aliases: ["Zithromax"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Clarithromycin", aliases: ["Biaxin"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Doxycycline", aliases: ["Vibramycin"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Minocycline", aliases: ["Minocin"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Clindamycin", aliases: ["Cleocin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Metronidazole", aliases: ["Flagyl"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Vancomycin", aliases: ["Vancocin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Linezolid", aliases: ["Zyvox"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Levofloxacin", aliases: ["Levaquin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q24H" },
  { name: "Ciprofloxacin", aliases: ["Cipro"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Trimethoprim/Sulfamethoxazole", aliases: ["Bactrim"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Nitrofurantoin", aliases: ["Macrobid"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Meropenem", aliases: ["Merrem"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Ertapenem", aliases: ["Invanz"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q24H" },

  { name: "Lisinopril", aliases: ["Prinivil"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Losartan", aliases: ["Cozaar"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Valsartan", aliases: ["Diovan"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Amlodipine", aliases: ["Norvasc"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Nifedipine", aliases: ["Procardia"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Metoprolol", aliases: ["Lopressor"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Carvedilol", aliases: ["Coreg"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Labetalol", aliases: ["Normodyne"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Q10MIN PRN" },
  { name: "Hydralazine", aliases: ["Apresoline"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Nitroglycerin", aliases: ["NTG"], category: "cardiovascular", controlled: false, defaultRoute: "SL", defaultFrequency: "Q5MIN PRN" },
  { name: "Isosorbide Mononitrate", aliases: ["Imdur"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Diltiazem", aliases: ["Cardizem"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Verapamil", aliases: ["Calan"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Amiodarone", aliases: ["Cordarone"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Adenosine", aliases: ["Adenocard"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Once PRN" },
  { name: "Atorvastatin", aliases: ["Lipitor"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Rosuvastatin", aliases: ["Crestor"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Furosemide", aliases: ["Lasix"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Bumetanide", aliases: ["Bumex"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Spironolactone", aliases: ["Aldactone"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Digoxin", aliases: ["Lanoxin"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },

  { name: "Albuterol", aliases: ["Ventolin"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q4H PRN" },
  { name: "Ipratropium", aliases: ["Atrovent"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q6H" },
  { name: "Levalbuterol", aliases: ["Xopenex"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q6H PRN" },
  { name: "Budesonide", aliases: ["Pulmicort"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "BID" },
  { name: "Fluticasone/Salmeterol", aliases: ["Advair"], category: "respiratory", controlled: false, defaultRoute: "Inhaled", defaultFrequency: "BID" },
  { name: "Tiotropium", aliases: ["Spiriva"], category: "respiratory", controlled: false, defaultRoute: "Inhaled", defaultFrequency: "Daily" },
  { name: "Montelukast", aliases: ["Singulair"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Prednisone", aliases: ["Deltasone"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Methylprednisolone", aliases: ["Solu-Medrol"], category: "respiratory", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },

  { name: "Insulin Lispro", aliases: ["Humalog"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Per protocol" },
  { name: "Insulin Aspart", aliases: ["Novolog"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Per protocol" },
  { name: "Insulin Glargine", aliases: ["Lantus"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Nightly" },
  { name: "Insulin Detemir", aliases: ["Levemir"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Daily" },
  { name: "Metformin", aliases: ["Glucophage"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Glipizide", aliases: ["Glucotrol"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Levothyroxine", aliases: ["Synthroid"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Hydrocortisone", aliases: ["Solu-Cortef"], category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H" },
  { name: "Dexamethasone", aliases: ["Decadron"], category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Calcium Gluconate", category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "Once PRN" },

  { name: "Ondansetron", aliases: ["Zofran"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H PRN" },
  { name: "Promethazine", aliases: ["Phenergan"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Metoclopramide", aliases: ["Reglan"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Pantoprazole", aliases: ["Protonix"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Omeprazole", aliases: ["Prilosec"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Famotidine", aliases: ["Pepcid"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Sucralfate", aliases: ["Carafate"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "QID" },
  { name: "Lactulose", category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID PRN" },
  { name: "Polyethylene Glycol", aliases: ["Miralax"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily PRN" },
  { name: "Senna", aliases: ["Senokot"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly PRN" },
  { name: "Docusate", aliases: ["Colace"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID PRN" },
  { name: "Loperamide", aliases: ["Imodium"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },

  { name: "Sertraline", aliases: ["Zoloft"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Fluoxetine", aliases: ["Prozac"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Escitalopram", aliases: ["Lexapro"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Bupropion", aliases: ["Wellbutrin"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Mirtazapine", aliases: ["Remeron"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Trazodone", aliases: ["Desyrel"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly PRN" },
  { name: "Haloperidol", aliases: ["Haldol"], category: "neuro_psych", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Olanzapine", aliases: ["Zyprexa"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Quetiapine", aliases: ["Seroquel"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Risperidone", aliases: ["Risperdal"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Levetiracetam", aliases: ["Keppra"], category: "neuro_psych", controlled: false, defaultRoute: "IV", defaultFrequency: "BID" },
  { name: "Valproic Acid", aliases: ["Depakote"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Phenytoin", aliases: ["Dilantin"], category: "neuro_psych", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Gabapentin", aliases: ["Neurontin"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Pregabalin", aliases: ["Lyrica"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Lorazepam", aliases: ["Ativan"], category: "neuro_psych", controlled: true, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Diazepam", aliases: ["Valium"], category: "neuro_psych", controlled: true, defaultRoute: "IV", defaultFrequency: "Q8H PRN" },
  { name: "Midazolam", aliases: ["Versed"], category: "neuro_psych", controlled: true, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Alprazolam", aliases: ["Xanax"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "TID PRN" },
  { name: "Clonazepam", aliases: ["Klonopin"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Zolpidem", aliases: ["Ambien"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Nightly PRN" },
  { name: "Dextroamphetamine/Amphetamine", aliases: ["Adderall"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Methylphenidate", aliases: ["Ritalin"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "BID" },

  { name: "Epinephrine", aliases: ["Adrenalin"], category: "critical_care", controlled: false, defaultRoute: "IM", defaultFrequency: "Once PRN" },
  { name: "Norepinephrine", aliases: ["Levophed"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Phenylephrine", aliases: ["Neo-Synephrine"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Vasopressin", aliases: ["Pitressin"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Dopamine", aliases: ["Intropin"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Dobutamine", aliases: ["Dobutrex"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Propofol", aliases: ["Diprivan"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Ketamine", aliases: ["Ketalar"], category: "critical_care", controlled: true, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Etomidate", aliases: ["Amidate"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Rocuronium", aliases: ["Zemuron"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Succinylcholine", aliases: ["Anectine"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Naloxone", aliases: ["Narcan"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Flumazenil", aliases: ["Romazicon"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Dextrose 50%", aliases: ["D50"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Glucagon", aliases: ["GlucaGen"], category: "critical_care", controlled: false, defaultRoute: "IM", defaultFrequency: "PRN" },
  { name: "Calcium Chloride", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Sodium Bicarbonate", aliases: ["Bicarb"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Magnesium Sulfate", aliases: ["Mag Sulf"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Tranexamic Acid", aliases: ["TXA"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },

  { name: "Heparin", category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Enoxaparin", aliases: ["Lovenox"], category: "anticoagulation", controlled: false, defaultRoute: "SC", defaultFrequency: "Q12H" },
  { name: "Warfarin", aliases: ["Coumadin"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Apixaban", aliases: ["Eliquis"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Rivaroxaban", aliases: ["Xarelto"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Dabigatran", aliases: ["Pradaxa"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Clopidogrel", aliases: ["Plavix"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Aspirin", aliases: ["ASA"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },

  { name: "Oxytocin", aliases: ["Pitocin"], category: "obgyn", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Misoprostol", aliases: ["Cytotec"], category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Per protocol" },
  { name: "Methylergonovine", aliases: ["Methergine"], category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "Q6H PRN" },
  { name: "Magnesium Sulfate (OB)", aliases: ["MgSO4"], category: "obgyn", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Rho(D) Immune Globulin", aliases: ["RhoGAM"], category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "Once" },

  { name: "Tamsulosin", aliases: ["Flomax"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Finasteride", aliases: ["Proscar"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Oxybutynin", aliases: ["Ditropan"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Potassium Chloride", aliases: ["KCl"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Sodium Zirconium Cyclosilicate", aliases: ["Lokelma"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Sevelamer", aliases: ["Renvela"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },

  { name: "Oseltamivir", aliases: ["Tamiflu"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Acyclovir", aliases: ["Zovirax"], category: "infectious_antiviral", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Valacyclovir", aliases: ["Valtrex"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Remdesivir", aliases: ["Veklury"], category: "infectious_antiviral", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Nirmatrelvir/Ritonavir", aliases: ["Paxlovid"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },

  // === IV FLUIDS (Essential formulary) ===
  // Crystalloids - Isotonic
  { name: "Normal Saline", aliases: ["0.9% NaCl", "NS", "Sodium Chloride 0.9%"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Lactated Ringer's", aliases: ["LR", "Ringers", "Ringer's Lactate", "Hartmann's"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Plasma-Lyte", aliases: ["Plasma-Lyte 148", "Plasma-Lyte A"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Normosol-R", aliases: ["Normosol", "Isolyte E"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },

  // Crystalloids - Hypotonic
  { name: "0.45% NaCl", aliases: ["Half Normal Saline", "1/2 NS", "0.45% Sodium Chloride"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "0.225% NaCl", aliases: ["Quarter Normal Saline", "1/4 NS", "0.225% Sodium Chloride"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },

  // Crystalloids - Hypertonic saline
  { name: "3% NaCl", aliases: ["3% Sodium Chloride", "Hypertonic Saline 3%"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "23.4% NaCl", aliases: ["Hypertonic Saline 23.4%", "23.4% Sodium Chloride"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },

  // Dextrose solutions
  { name: "D5W", aliases: ["Dextrose 5%", "5% Dextrose in Water", "D5 Water"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "D10W", aliases: ["10% Dextrose", "Dextrose 10% in Water"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "D20W", aliases: ["20% Dextrose"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "D50W", aliases: ["50% Dextrose", "Dextrose 50%", "D50"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "One-time" },

  // Dextrose + saline combinations
  { name: "D5 1/2 NS", aliases: ["D5 Half Normal Saline", "D5 0.45% NaCl", "D5W 1/2 NS"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "D5 1/4 NS", aliases: ["D5 Quarter Normal Saline", "D5 0.225% NaCl", "D5W 1/4 NS"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "D5NS", aliases: ["D5 Normal Saline", "D5 0.9% NaCl", "D5W in NS"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "D2.5 1/2 NS", aliases: ["D2.5 Half Normal Saline", "2.5% Dextrose in 0.45% NaCl"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },

  // Dextrose + balanced crystalloids
  { name: "D5 Lactated Ringer's", aliases: ["D5 LR", "D5 Ringers"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },

  // Balanced/alternative crystalloids
  { name: "Plasma-Lyte 56", aliases: ["Plasma-Lyte M"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Acetated Ringer's", aliases: ["Acetate Ringer", "Ringer's Acetate"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Isolyte S", aliases: ["Isolyte"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },

  // Potassium-containing maintenance fluids
  { name: "NS with 20 mEq KCl", aliases: ["0.9% NaCl with potassium", "NS + K"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "NS with 40 mEq KCl", aliases: ["0.9% NaCl with 40 mEq K"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "LR with 20 mEq KCl", aliases: ["Lactated Ringer's with potassium", "LR + K"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "D5 0.45% NaCl with 20 mEq KCl", aliases: ["D5 1/2 NS with K", "D5 Half NS with potassium"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "D5 0.225% NaCl with 20 mEq KCl", aliases: ["D5 1/4 NS with K", "D5 Quarter NS with potassium"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },

  // Colloids & volume expanders
  { name: "Albumin 5%", aliases: ["5% Albumin", "Human Albumin", "Albumin Human 5%"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Albumin 25%", aliases: ["25% Albumin", "Salt-poor Albumin", "Albumin Human 25%"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Hetastarch", aliases: ["Hextend", "Hespan", "Hydroxyethyl starch", "HES"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Dextran 40", aliases: ["LMD", "Low Molecular Weight Dextran"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },

  // Special / adjunct solutions
  { name: "Sodium Bicarbonate", aliases: ["NaHCO3", "Bicarb", "8.4% Sodium Bicarbonate"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Sterile Water for Injection", aliases: ["SWFI", "WFI", "Water for Injection"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Mannitol", aliases: ["20% Mannitol", "Mannitol 20%"], category: "iv_fluids", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },

  { name: "Diphenhydramine", aliases: ["Benadryl"], category: "misc", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Cetirizine", aliases: ["Zyrtec"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Loratadine", aliases: ["Claritin"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Hydroxyzine", aliases: ["Vistaril"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q8H PRN" },
  { name: "Allopurinol", aliases: ["Zyloprim"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Colchicine", aliases: ["Colcrys"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Nicotine Patch", aliases: ["Nicoderm"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "Daily" },
  { name: "Folic Acid", aliases: ["Folvite"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Thiamine", aliases: ["Vitamin B1"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Multivitamin", aliases: ["MVI"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Cyanocobalamin", aliases: ["Vitamin B12"], category: "misc", controlled: false, defaultRoute: "IM", defaultFrequency: "Monthly" },

  // Additional analgesics
  { name: "Acetaminophen/Codeine", aliases: ["Tylenol #3"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q4H PRN" },
  { name: "Tapentadol", aliases: ["Nucynta"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q4H PRN" },
  { name: "Nalbuphine", aliases: ["Nubain"], category: "analgesics", controlled: true, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Butorphanol", aliases: ["Stadol"], category: "analgesics", controlled: true, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Aspirin", category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Q4H PRN" },
  { name: "Venlafaxine", aliases: ["Effexor"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Nortriptyline", aliases: ["Pamelor"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Amitriptyline", aliases: ["Elavil"], category: "analgesics", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Topical Lidocaine", aliases: ["Lidocaine 5%"], category: "analgesics", controlled: false, defaultRoute: "Topical", defaultFrequency: "Q8H PRN" },

  // Additional antibiotics
  { name: "Fluconazole", aliases: ["Diflucan"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Voriconazole", aliases: ["Vfend"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Amphotericin B", aliases: ["AmBisome"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Gentamicin", category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Tobramycin", aliases: ["Nebcin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Amikacin", aliases: ["Amikin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q24H" },
  { name: "Cefuroxime", aliases: ["Ceftin"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Cefuroxime Axetil", category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Ceftaroline", aliases: ["Teflaro"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Daptomycin", aliases: ["Cubicin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q24H" },
  { name: "Telavancin", aliases: ["Vibativ"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Tigecycline", aliases: ["Tygacil"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Colistin", aliases: ["Coly-Mycin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Polymyxin B", category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Erythromycin", category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "QID" },
  { name: "Fosfomycin", aliases: ["Monurol"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "Once" },
  { name: "Cefpodoxime", aliases: ["Vantin"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Cefixime", aliases: ["Suprax"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Aztreonam", aliases: ["Azactam"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Imipenem/Cilastatin", aliases: ["Primaxin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H" },

  // Additional cardiovascular
  { name: "Enalapril", aliases: ["Vasotec"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Ramipril", aliases: ["Altace"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Benazepril", aliases: ["Lotensin"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Quinapril", aliases: ["Accupril"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Olmesartan", aliases: ["Benicar"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Irbesartan", aliases: ["Avapro"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Candesartan", aliases: ["Atacand"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Felodipine", aliases: ["Plendil"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Atenolol", aliases: ["Tenormin"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Propranolol", aliases: ["Inderal"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Esmolol", aliases: ["Brevibloc"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Lidocaine", aliases: ["Xylocaine"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Procainamide", aliases: ["Pronestyl"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Sotalol", aliases: ["Betapace"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Dofetilide", aliases: ["Tikosyn"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Flecainide", aliases: ["Tambocor"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Propafenone", aliases: ["Rythmol"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Simvastatin", aliases: ["Zocor"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Pravastatin", aliases: ["Pravachol"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Lovastatin", aliases: ["Mevacor"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Ezetimibe", aliases: ["Zetia"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Ezetimibe/Simvastatin", aliases: ["Vytorin"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Torsemide", aliases: ["Demadex"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Hydrochlorothiazide", aliases: ["HCTZ"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Chlorthalidone", aliases: ["Thalitone"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Triamterene/HCTZ", aliases: ["Dyazide"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Eplerenone", aliases: ["Inspra"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Milrinone", aliases: ["Primacor"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Nitropress", aliases: ["Nitroprusside"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Clevidipine", aliases: ["Cleviprex"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Nicardipine", aliases: ["Cardene"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Verapamil IV", category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },

  // Additional respiratory
  { name: "Methylprednisolone Dose Pack", aliases: ["Medrol Dosepak"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "Taper" },
  { name: "Prednisolone", aliases: ["Orapred"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Albuterol/Ipratropium", aliases: ["Combivent"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q6H" },
  { name: "Formoterol/Budesonide", aliases: ["Symbicort"], category: "respiratory", controlled: false, defaultRoute: "Inhaled", defaultFrequency: "BID" },
  { name: "Acetylcysteine", aliases: ["Mucomyst"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q6H" },
  { name: "Racemic Epinephrine", aliases: ["L-epinephrine"], category: "respiratory", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q2H PRN" },
  { name: "Heliox", category: "respiratory", controlled: false, defaultRoute: "Inhaled", defaultFrequency: "Continuous" },
  { name: "Nitric Oxide", category: "respiratory", controlled: false, defaultRoute: "Inhaled", defaultFrequency: "Continuous" },
  { name: "Treprostinil", aliases: ["Remodulin"], category: "respiratory", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Sildenafil", aliases: ["Revatio"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Tadalafil", aliases: ["Adcirca"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Riociguat", aliases: ["Adempas"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Macitentan", aliases: ["Opsumit"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Epoprostenol", aliases: ["Flolan"], category: "respiratory", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Zafirlukast", aliases: ["Accolate"], category: "respiratory", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Omalizumab", aliases: ["Xolair"], category: "respiratory", controlled: false, defaultRoute: "SC", defaultFrequency: "Q2-4 weeks" },

  // Additional endocrine
  { name: "Sitagliptin", aliases: ["Januvia"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Empagliflozin", aliases: ["Jardiance"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Canagliflozin", aliases: ["Invokana"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Dapagliflozin", aliases: ["Farxiga"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Liraglutide", aliases: ["Victoza"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Daily" },
  { name: "Semaglutide", aliases: ["Ozempic"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Weekly" },
  { name: "Exenatide", aliases: ["Byetta"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "BID" },
  { name: "Glimepiride", aliases: ["Amaryl"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Glyburide", aliases: ["DiaBeta"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Saxagliptin", aliases: ["Onglyza"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Linagliptin", aliases: ["Tradjenta"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Alogliptin", aliases: ["Nesina"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Octreotide", aliases: ["Sandostatin"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "TID" },
  { name: "Desmopressin", aliases: ["DDAVP"], category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Vasopressin", category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Potassium Phosphate", category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Magnesium Oxide", aliases: ["Mag-Ox"], category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Ferrous Sulfate", category: "endocrine", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Iron Sucrose", aliases: ["Venofer"], category: "endocrine", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Epoetin Alfa", aliases: ["Epogen"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Weekly" },
  { name: "Darbepoetin", aliases: ["Aranesp"], category: "endocrine", controlled: false, defaultRoute: "SC", defaultFrequency: "Weekly" },

  // Additional GI
  { name: "Hyoscyamine", aliases: ["Levsin"], category: "gi", controlled: false, defaultRoute: "SL", defaultFrequency: "Q4H PRN" },
  { name: "Dicyclomine", aliases: ["Bentyl"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "QID" },
  { name: "Scopolamine", aliases: ["Transderm Scop"], category: "gi", controlled: false, defaultRoute: "Patch", defaultFrequency: "Q72H" },
  { name: "Alosetron", aliases: ["Lotronex"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Lubiprostone", aliases: ["Amitiza"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Linaclotide", aliases: ["Linzess"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Ursodiol", aliases: ["Actigall"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Rifaximin", aliases: ["Xifaxan"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Neomycin", category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H" },
  { name: "Bisacodyl", aliases: ["Dulcolax"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Phosphorated Carbohydrate", aliases: ["Emetrol"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Aprepitant", aliases: ["Emend"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Fosaprepitant", category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Granisetron", aliases: ["Kytril"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Q24H" },
  { name: "Palonosetron", aliases: ["Aloxi"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Dolasetron", aliases: ["Anzemet"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Esomeprazole", aliases: ["Nexium"], category: "gi", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Lansoprazole", aliases: ["Prevacid"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Rabeprazole", aliases: ["Aciphex"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Dexlansoprazole", aliases: ["Dexilant"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },

  // Additional neuro/psych
  { name: "Citalopram", aliases: ["Celexa"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Paroxetine", aliases: ["Paxil"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Venlafaxine XR", aliases: ["Effexor XR"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Duloxetine", aliases: ["Cymbalta"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Desvenlafaxine", aliases: ["Pristiq"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Vilazodone", aliases: ["Viibryd"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Vortioxetine", aliases: ["Trintellix"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Lithium", aliases: ["Lithobid"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Lamotrigine", aliases: ["Lamictal"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Carbamazepine", aliases: ["Tegretol"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Oxcarbazepine", aliases: ["Trileptal"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Topiramate", aliases: ["Topamax"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Lacosamide", aliases: ["Vimpat"], category: "neuro_psych", controlled: false, defaultRoute: "IV", defaultFrequency: "BID" },
  { name: "Phenobarbital", category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Brivaracetam", aliases: ["Briviact"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Perphenazine", aliases: ["Trilafon"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Aripiprazole", aliases: ["Abilify"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Ziprasidone", aliases: ["Geodon"], category: "neuro_psych", controlled: false, defaultRoute: "IM", defaultFrequency: "Q2H PRN" },
  { name: "Chlorpromazine", aliases: ["Thorazine"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Prochlorperazine", aliases: ["Compazine"], category: "neuro_psych", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H PRN" },
  { name: "Droperidol", category: "neuro_psych", controlled: false, defaultRoute: "IV", defaultFrequency: "Q4H PRN" },
  { name: "Clozapine", aliases: ["Clozaril"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Buspirone", aliases: ["Buspar"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Hydroxyzine", category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Propranolol", category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Clonidine", aliases: ["Catapres"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Guanfacine", aliases: ["Intuniv"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Lisdexamfetamine", aliases: ["Vyvanse"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Dextroamphetamine", aliases: ["Dexedrine"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Atomoxetine", aliases: ["Strattera"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Modafinil", aliases: ["Provigil"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Armodafinil", aliases: ["Nuvigil"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Eszopiclone", aliases: ["Lunesta"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Nightly PRN" },
  { name: "Ramelteon", aliases: ["Rozerem"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Suvorexant", aliases: ["Belsomra"], category: "neuro_psych", controlled: true, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Doxylamine", aliases: ["Unisom"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly PRN" },
  { name: "Melatonin", category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },

  // Additional critical care
  { name: "Nitroglycerin IV", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Isoproterenol", aliases: ["Isuprel"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Milrinone", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Inamrinone", aliases: ["Inocor"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Vasopressin", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Terlipressin", aliases: ["Terlipressin"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Q4H" },
  { name: "Angiotensin II", aliases: ["Giapreza"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Bicarbonate", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Potassium Chloride IV", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Phosphate", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Insulin Regular", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Recombinant Factor VIIa", aliases: ["NovoSeven"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Prothrombin Complex", aliases: ["Kcentra"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Andexanet Alfa", aliases: ["Andexxa"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Idarucizumab", aliases: ["Praxbind"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Protamine", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Vitamin K", aliases: ["Phytonadione"], category: "critical_care", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Desmopressin", category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Aminocaproic Acid", aliases: ["Amicar"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Q6H" },

  // Additional anticoagulation
  { name: "Edoxaban", aliases: ["Savaysa"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Ticagrelor", aliases: ["Brilinta"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Prasugrel", aliases: ["Effient"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Ticlopidine", aliases: ["Ticlid"], category: "anticoagulation", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Cangrelor", aliases: ["Kengreal"], category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Abciximab", aliases: ["ReoPro"], category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Eptifibatide", aliases: ["Integrilin"], category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Tirofiban", aliases: ["Aggrastat"], category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Argatroban", category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Bivalirudin", aliases: ["Angiomax"], category: "anticoagulation", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Fondaparinux", aliases: ["Arixtra"], category: "anticoagulation", controlled: false, defaultRoute: "SC", defaultFrequency: "Daily" },

  // Additional OB/GYN
  { name: "Dinoprostone", aliases: ["Cervidil"], category: "obgyn", controlled: false, defaultRoute: "Vaginal", defaultFrequency: "Once" },
  { name: "Carboprost", aliases: ["Hemabate"], category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "Q15MIN PRN" },
  { name: "Dinoprost", aliases: ["Prostin F2"], category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "PRN" },
  { name: "Terbutaline", aliases: ["Brethine"], category: "obgyn", controlled: false, defaultRoute: "SC", defaultFrequency: "Q20MIN PRN" },
  { name: "Nifedipine", category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H" },
  { name: "Indomethacin", aliases: ["Indocin"], category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H" },
  { name: "Betamethasone", aliases: ["Celestone"], category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "Q24H x 2" },
  { name: "Dexamethasone", category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "Q12H x 4" },
  { name: "Ferrous Gluconate", category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Prenatal Vitamin", category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Medroxyprogesterone", aliases: ["Depo-Provera"], category: "obgyn", controlled: false, defaultRoute: "IM", defaultFrequency: "Q12 weeks" },
  { name: "Levonorgestrel IUD", aliases: ["Mirena"], category: "obgyn", controlled: false, defaultRoute: "Insert", defaultFrequency: "5 years" },
  { name: "Conjugated Estrogen", aliases: ["Premarin"], category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Estradiol", aliases: ["Estrace"], category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Progesterone", aliases: ["Prometrium"], category: "obgyn", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },

  // Additional renal/urology
  { name: "Solifenacin", aliases: ["Vesicare"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Mirabegron", aliases: ["Myrbetriq"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Tolterodine", aliases: ["Detrol"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Darifenacin", aliases: ["Enablex"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Sildenafil", aliases: ["Viagra"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Tadalafil", aliases: ["Cialis"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Vardenafil", aliases: ["Levitra"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Alfuzosin", aliases: ["Uroxatral"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Dutasteride", aliases: ["Avodart"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Silodosin", aliases: ["Rapaflo"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Phenazopyridine", aliases: ["Pyridium"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "TID PRN" },
  { name: "Methylprednisolone", category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Prednisone", category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Mycophenolate", aliases: ["CellCept"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Tacrolimus", aliases: ["Prograf"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Cyclosporine", aliases: ["Sandimmune"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Sirolimus", aliases: ["Rapamune"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Everolimus", aliases: ["Zortress"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Belatacept", aliases: ["Nulojix"], category: "renal_urology", controlled: false, defaultRoute: "IV", defaultFrequency: "Monthly" },
  { name: "Rituximab", aliases: ["Rituxan"], category: "renal_urology", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },

  // Additional infectious/antiviral
  { name: "Ganciclovir", aliases: ["Cytovene"], category: "infectious_antiviral", controlled: false, defaultRoute: "IV", defaultFrequency: "BID" },
  { name: "Valganciclovir", aliases: ["Valcyte"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Foscarnet", aliases: ["Foscavir"], category: "infectious_antiviral", controlled: false, defaultRoute: "IV", defaultFrequency: "BID" },
  { name: "Cidofovir", aliases: ["Vistide"], category: "infectious_antiviral", controlled: false, defaultRoute: "IV", defaultFrequency: "Weekly" },
  { name: "Famciclovir", aliases: ["Famvir"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Letermovir", aliases: ["Prevymis"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Maraviroc", aliases: ["Selzentry"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Raltegravir", aliases: ["Isentress"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Dolutegravir", aliases: ["Tivicay"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Bictegravir/Emtricitabine/Tenofovir", aliases: ["Biktarvy"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Baloxavir", aliases: ["Xofluza"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Once" },
  { name: "Zanamivir", aliases: ["Relenza"], category: "infectious_antiviral", controlled: false, defaultRoute: "Inhaled", defaultFrequency: "BID" },
  { name: "Peramivir", aliases: ["Rapivab"], category: "infectious_antiviral", controlled: false, defaultRoute: "IV", defaultFrequency: "Once" },
  { name: "Ribavirin", aliases: ["Virazole"], category: "infectious_antiviral", controlled: false, defaultRoute: "Neb", defaultFrequency: "Q8H" },
  { name: "Sofosbuvir", aliases: ["Sovaldi"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Ledipasvir/Sofosbuvir", aliases: ["Harvoni"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Elbasvir/Grazoprevir", aliases: ["Zepatier"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Glecaprevir/Pibrentasvir", aliases: ["Mavyret"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Entecavir", aliases: ["Baraclude"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Tenofovir", aliases: ["Viread"], category: "infectious_antiviral", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },

  // Additional misc
  { name: "Ranitidine", aliases: ["Zantac"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Cyclizine", aliases: ["Marezine"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q8H PRN" },
  { name: "Scopolamine Patch", category: "misc", controlled: false, defaultRoute: "Patch", defaultFrequency: "Q72H" },
  { name: "Meclizine", aliases: ["Antivert"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q8H PRN" },
  { name: "Dimenhydrinate", aliases: ["Dramamine"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Pyridoxine", aliases: ["Vitamin B6"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Vitamin D", aliases: ["Cholecalciferol"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Vitamin D2", aliases: ["Ergocalciferol"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Weekly" },
  { name: "Calcitriol", aliases: ["Rocaltrol"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Zinc Sulfate", category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Potassium Chloride", category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Sodium Chloride", category: "misc", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Albumin 5%", category: "misc", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Albumin 25%", category: "misc", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Immune Globulin", aliases: ["IVIG"], category: "misc", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Pneumococcal Vaccine", aliases: ["Pneumovax"], category: "misc", controlled: false, defaultRoute: "IM", defaultFrequency: "Once" },
  { name: "Influenza Vaccine", category: "misc", controlled: false, defaultRoute: "IM", defaultFrequency: "Yearly" },
  { name: "Tetanus/Diphtheria/Pertussis", aliases: ["Tdap"], category: "misc", controlled: false, defaultRoute: "IM", defaultFrequency: "Q10 years" },
  { name: "Varicella Vaccine", aliases: ["Varivax"], category: "misc", controlled: false, defaultRoute: "SC", defaultFrequency: "x2" },
  { name: "Hepatitis B Vaccine", category: "misc", controlled: false, defaultRoute: "IM", defaultFrequency: "x3" },
  { name: "Hepatitis A Vaccine", category: "misc", controlled: false, defaultRoute: "IM", defaultFrequency: "x2" },
  { name: "Methylphenidate ER", aliases: ["Concerta"], category: "misc", controlled: true, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Dextromethorphan", aliases: ["Robitussin"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q4H PRN" },
  { name: "Guaifenesin", aliases: ["Mucinex"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q12H PRN" },
  { name: "Pseudoephedrine", aliases: ["Sudafed"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Chlorhexidine", aliases: ["Hibiclens"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "Daily" },
  { name: "Mupirocin", aliases: ["Bactroban"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "TID" },
  { name: "Clotrimazole", aliases: ["Lotrimin"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "BID" },
  { name: "Ketoconazole", aliases: ["Nizoral"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "Daily" },
  { name: "Terbinafine", aliases: ["Lamisil"], category: "misc", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Fluocinonide", aliases: ["Lidex"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "BID" },
  { name: "Triamcinolone", aliases: ["Kenalog"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "BID" },
  { name: "Hydrocortisone Cream", category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "BID" },
  { name: "Silver Sulfadiazine", aliases: ["Silvadene"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "BID" },
  { name: "Bacitracin", category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "TID" },
  { name: "Neomycin/Polymyxin/Bacitracin", aliases: ["Neosporin"], category: "misc", controlled: false, defaultRoute: "Topical", defaultFrequency: "TID" },
  { name: "Lidocaine Patch", aliases: ["Lidoderm"], category: "analgesics", controlled: false, defaultRoute: "Patch", defaultFrequency: "Q12H" },
  { name: "Tapentadol", aliases: ["Nucynta"], category: "analgesics", controlled: true, defaultRoute: "PO", defaultFrequency: "Q4-6H" },
  { name: "Buprenorphine", aliases: ["Subutex"], category: "analgesics", controlled: true, defaultRoute: "SL", defaultFrequency: "Q8H" },
  { name: "Linezolid", aliases: ["Zyvox"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Daptomycin", aliases: ["Cubicin"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Daily" },
  { name: "Ceftolozane/Tazobactam", aliases: ["Zerbaxa"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Ceftazidime/Avibactam", aliases: ["Avycaz"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Meropenem/Vaborbactam", aliases: ["Vabomere"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q8H" },
  { name: "Tedizolid", aliases: ["Sivextro"], category: "antibiotics", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Lefamulin", aliases: ["Xenleta"], category: "antibiotics", controlled: false, defaultRoute: "IV", defaultFrequency: "Q12H" },
  { name: "Isosorbide Mononitrate", aliases: ["Imdur"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Isosorbide Dinitrate", aliases: ["Isordil"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H" },
  { name: "Hydralazine", aliases: ["Apresoline"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Q8H" },
  { name: "Clonidine", aliases: ["Catapres"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Digoxin", aliases: ["Lanoxin"], category: "cardiovascular", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Lacosamide", aliases: ["Vimpat"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Brivaracetam", aliases: ["Briviact"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Perampanel", aliases: ["Fycompa"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Oxcarbazepine", aliases: ["Trileptal"], category: "neuro_psych", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Simethicone", aliases: ["Gas-X"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H PRN" },
  { name: "Magnesium Hydroxide", aliases: ["Milk of Magnesia"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Lactulose", aliases: ["Enulose"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Polyethylene Glycol", aliases: ["Miralax"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Daily" },
  { name: "Bisacodyl", aliases: ["Dulcolax"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Senna", aliases: ["Senokot"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Nightly" },
  { name: "Docusate", aliases: ["Colace"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "BID" },
  { name: "Rifaximin", aliases: ["Xifaxan"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
  { name: "Sucralfate", aliases: ["Carafate"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H" },
  { name: "Calcium Carbonate", aliases: ["Tums"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Loperamide", aliases: ["Imodium"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "PRN" },
  { name: "Dicyclomine", aliases: ["Bentyl"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Q6H" },
  { name: "Hyoscyamine", aliases: ["Levsin"], category: "gi", controlled: false, defaultRoute: "PO", defaultFrequency: "Q4H PRN" },
  { name: "Dexmedetomidine", aliases: ["Precedex"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Vecuronium", aliases: ["Norcuron"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "PRN" },
  { name: "Cisatracurium", aliases: ["Nimbex"], category: "critical_care", controlled: false, defaultRoute: "IV", defaultFrequency: "Continuous" },
  { name: "Lidocaine IV", aliases: ["Xylocaine"], category: "cardiovascular", controlled: false, defaultRoute: "IV", defaultFrequency: "Per protocol" },
  { name: "Sevelamer", aliases: ["Renagel"], category: "renal_urology", controlled: false, defaultRoute: "PO", defaultFrequency: "TID" },
];

/** Deduplicated formulary for picker/search — first occurrence per name wins. */
export const MEDICATION_FORMULARY_DEDUPED: MedicationItem[] = deduplicateFormulary(MEDICATION_FORMULARY);
