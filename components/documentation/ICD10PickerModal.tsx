"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ICD10_CODES, type ICD10Code } from "@/lib/icd10";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, X } from "lucide-react";

interface ICD10PickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (code: ICD10Code) => void;
}

const ICD_CATEGORIES = [
  "all",
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

type ICDCategory = (typeof ICD_CATEGORIES)[number];

const CATEGORY_LABELS: Record<ICDCategory, string> = {
  all: "All",
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

function getICDCategory(code: string): ICDCategory {
  const c = code.toUpperCase();
  if (c.startsWith("S") || c.startsWith("T")) return "trauma_injury";
  if (c.startsWith("V") || c.startsWith("W") || c.startsWith("X") || c.startsWith("Y")) {
    return "external_causes";
  }
  if (c.startsWith("A") || c.startsWith("B")) return "infectious";
  if (c.startsWith("E")) return "endocrine";
  if (c.startsWith("F")) return "mental_health";
  if (c.startsWith("G")) return "neuro";
  if (c.startsWith("H")) return "ent_eye";
  if (c.startsWith("I")) return "cardio";
  if (c.startsWith("J")) return "respiratory";
  if (c.startsWith("K")) return "gi";
  if (c.startsWith("N")) return "gu";
  if (c.startsWith("O")) return "obstetric";
  if (c.startsWith("M")) return "musculoskeletal";
  if (c.startsWith("L")) return "skin";
  if (c.startsWith("R")) return "symptoms";
  if (c.startsWith("Z")) return "followup_zcodes";
  return "all";
}

export function ICD10PickerModal({ open, onClose, onSelect }: ICD10PickerModalProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ICDCategory>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const loadFavorites = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("icd10_favorites")
        .eq("id", user.id)
        .maybeSingle();

      const list = Array.isArray(profile?.icd10_favorites)
        ? (profile?.icd10_favorites as unknown[])
            .map((x) => (typeof x === "string" ? x : ""))
            .filter(Boolean)
        : [];
      setFavorites(list);
    };

    void loadFavorites();
  }, [open]);

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byCategory =
      category === "all"
        ? ICD10_CODES
        : ICD10_CODES.filter((c) => getICDCategory(c.code) === category);
    const codes = q
      ? byCategory.filter(
          (c) => c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)
        )
      : byCategory;

    return [...codes].sort((a, b) => {
      const af = favorites.includes(a.code) ? 1 : 0;
      const bf = favorites.includes(b.code) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.code.localeCompare(b.code);
    });
  }, [category, favorites, search]);

  const persistFavorites = async (next: string[]) => {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ icd10_favorites: next }).eq("id", userId);
    setSaving(false);
  };

  const toggleFavorite = async (code: string) => {
    const next = favorites.includes(code)
      ? favorites.filter((c) => c !== code)
      : [code, ...favorites];
    setFavorites(next);
    await persistFavorites(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <CardTitle>ICD-10 Code Picker</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search ICD-10 by code or diagnosis (e.g. "fracture", "W54", "burn")'
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ICDCategory)}
              className="h-9 rounded border border-slate-300 bg-white px-2 text-sm"
            >
              {ICD_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded border border-slate-200">
            <div className="grid grid-cols-[auto_140px_1fr] border-b bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <span>Fav</span>
              <span>Code</span>
              <span>Diagnosis</span>
            </div>
            <div className="max-h-[58vh] overflow-auto">
              {filteredCodes.map((item) => {
                const isFav = favorites.includes(item.code);
                return (
                  <button
                    type="button"
                    key={item.code}
                    className="grid w-full grid-cols-[auto_140px_1fr] items-start gap-2 border-b px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFavorite(item.code);
                      }}
                      title={isFav ? "Remove favorite" : "Add favorite"}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          isFav ? "fill-amber-400 text-amber-500" : "text-slate-400"
                        }`}
                      />
                    </span>
                    <span className="font-medium text-slate-900">{item.code}</span>
                    <span className="text-slate-700">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Showing {filteredCodes.length} codes. Favorites are pinned to the top.
            {saving ? " Saving favorites..." : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
