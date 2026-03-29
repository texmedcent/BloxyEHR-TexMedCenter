"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ICD10_CODES, inferIcd10Category, type ICD10Code } from "@/lib/icd10";
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

export function ICD10PickerModal({ open, onClose, onSelect }: ICD10PickerModalProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ICDCategory>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [catalogCodes, setCatalogCodes] = useState<ICD10Code[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogBacked, setCatalogBacked] = useState(false);
  const [unspecifiedOtherText, setUnspecifiedOtherText] = useState("");

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

  useEffect(() => {
    if (!open) return;

    const loadCatalogCodes = async () => {
      setLoadingCatalog(true);
      const supabase = createClient();
      let query = supabase
        .from("icd10_catalog")
        .select("code, label")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (category !== "all") {
        query = query.eq("category_key", category);
      }
      query = query.limit(category === "all" ? 2000 : 500);
      if (search.trim()) {
        const q = search.trim().replace(/[,{}]/g, " ");
        query = query.or(`code.ilike.%${q}%,label.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) {
        setCatalogBacked(false);
        setCatalogCodes([]);
        setLoadingCatalog(false);
        return;
      }

      const rows = (data || []).map((row) => ({ code: row.code, label: row.label }));
      setCatalogCodes(rows);
      setCatalogBacked(rows.length > 0);
      setLoadingCatalog(false);
    };

    void loadCatalogCodes();
  }, [category, open, search]);

  const filteredCodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const localByCategory =
      category === "all"
        ? ICD10_CODES
        : ICD10_CODES.filter((c) => inferIcd10Category(c.code) === category);

    const localCodes = q
      ? localByCategory.filter(
          (c) => c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)
        )
      : localByCategory;

    let codes: ICD10Code[];
    if (category === "all") {
      const byCode = new Map<string, ICD10Code>();
      for (const c of localCodes) byCode.set(c.code, c);
      for (const c of catalogCodes) {
        if (!byCode.has(c.code)) byCode.set(c.code, c);
      }
      codes = Array.from(byCode.values());
    } else {
      codes = catalogBacked && catalogCodes.length > 0 ? catalogCodes : localCodes;
    }

    return [...codes].sort((a, b) => {
      const af = favorites.includes(a.code) ? 1 : 0;
      const bf = favorites.includes(b.code) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.code.localeCompare(b.code);
    });
  }, [catalogBacked, catalogCodes, category, favorites, search]);

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
              className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
            >
              {ICD_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded border border-slate-200 dark:border-border">
            <div className="grid grid-cols-[auto_140px_1fr] border-b bg-slate-50 dark:bg-muted px-3 py-2 text-xs font-semibold text-slate-600 dark:text-muted-foreground">
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
                    className="grid w-full grid-cols-[auto_140px_1fr] items-start gap-2 border-b border-slate-200/50 dark:border-border/50 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-muted"
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
                    <span className="font-medium text-slate-900 dark:text-foreground">{item.code}</span>
                    <span className="text-slate-700 dark:text-foreground">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Fallback
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
              <Input
                value={unspecifiedOtherText}
                onChange={(event) => setUnspecifiedOtherText(event.target.value)}
                placeholder='Unspecified - Other: type diagnosis (optional)'
              />
              <Button
                variant="outline"
                onClick={() => {
                  const nextLabel = unspecifiedOtherText.trim() || "Unspecified - Other";
                  onSelect({ code: "R69", label: nextLabel });
                  onClose();
                }}
              >
                Use Unspecified - Other
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
              Uses code <span className="font-medium text-slate-700 dark:text-foreground">R69</span> as fallback when no exact code fits.
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-muted-foreground">
            Showing {filteredCodes.length} codes.
            {category === "all" ? " Bundled + custom catalog." : catalogBacked ? " From catalog." : " From bundled set."}
            {" "}Favorites pinned to top.
            {saving ? " Saving..." : ""}
            {loadingCatalog ? " Loading..." : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
