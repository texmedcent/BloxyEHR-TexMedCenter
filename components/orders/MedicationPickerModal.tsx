"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MEDICATION_CATEGORIES,
  MEDICATION_CATEGORY_LABELS,
  MEDICATION_FORMULARY,
  type MedicationCategory,
  type MedicationItem,
} from "@/lib/medications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, X } from "lucide-react";

interface MedicationPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (medication: MedicationItem) => void;
}

export function MedicationPickerModal({ open, onClose, onSelect }: MedicationPickerModalProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MedicationCategory>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [catalogMeds, setCatalogMeds] = useState<MedicationItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogBacked, setCatalogBacked] = useState(false);

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
        .select("medication_favorites")
        .eq("id", user.id)
        .maybeSingle();
      const list = Array.isArray(profile?.medication_favorites)
        ? (profile?.medication_favorites as unknown[])
            .map((x) => (typeof x === "string" ? x : ""))
            .filter(Boolean)
        : [];
      setFavorites(list);
    };
    void loadFavorites();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const loadCatalogMeds = async () => {
      setLoadingCatalog(true);
      const supabase = createClient();
      let query = supabase
        .from("medication_catalog")
        .select("generic_name, brand_names, category_key, controlled, default_route, default_frequency")
        .eq("is_active", true)
        .order("generic_name", { ascending: true })
        .limit(500);

      if (category !== "all") {
        query = query.eq("category_key", category);
      }
      if (search.trim()) {
        const q = search.trim().replace(/[,{}]/g, " ");
        query = query.or(`generic_name.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) {
        setCatalogMeds([]);
        setCatalogBacked(false);
        setLoadingCatalog(false);
        return;
      }

      const rows: MedicationItem[] = (data || []).map((row) => ({
        name: row.generic_name,
        aliases: Array.isArray(row.brand_names) ? row.brand_names : [],
        category: (row.category_key as MedicationItem["category"]) || "misc",
        controlled: Boolean(row.controlled),
        defaultRoute: row.default_route || undefined,
        defaultFrequency: row.default_frequency || undefined,
      }));
      setCatalogMeds(rows);
      setCatalogBacked(rows.length > 0);
      setLoadingCatalog(false);
    };

    void loadCatalogMeds();
  }, [category, open, search]);

  const filteredMeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    const localByCategory =
      category === "all"
        ? MEDICATION_FORMULARY
        : MEDICATION_FORMULARY.filter((med) => med.category === category);

    const localRows = q
      ? localByCategory.filter((med) => {
          if (med.name.toLowerCase().includes(q)) return true;
          return (med.aliases || []).some((alias) => alias.toLowerCase().includes(q));
        })
      : localByCategory;

    const rows = catalogBacked ? catalogMeds : localRows;

    return [...rows].sort((a, b) => {
      const af = favorites.includes(a.name) ? 1 : 0;
      const bf = favorites.includes(b.name) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.name.localeCompare(b.name);
    });
  }, [catalogBacked, catalogMeds, category, favorites, search]);

  const persistFavorites = async (next: string[]) => {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ medication_favorites: next }).eq("id", userId);
    setSaving(false);
  };

  const toggleFavorite = async (name: string) => {
    const next = favorites.includes(name)
      ? favorites.filter((item) => item !== name)
      : [name, ...favorites];
    setFavorites(next);
    await persistFavorites(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-5xl flex-col">
        <CardHeader className="flex shrink-0 flex-row items-center justify-between">
          <CardTitle>Medication Picker</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 overflow-hidden">
          <div className="grid gap-2 md:grid-cols-[1fr_240px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search medications by generic or brand (e.g. "ceftriaxone", "zofran", "morphine")'
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MedicationCategory)}
              className="h-9 rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-sm"
            >
              {MEDICATION_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {MEDICATION_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-slate-200 dark:border-border">
            <div className="grid grid-cols-[auto_280px_1fr_120px] border-b bg-slate-50 dark:bg-muted px-3 py-2 text-xs font-semibold text-slate-600 dark:text-muted-foreground">
              <span>Fav</span>
              <span>Medication</span>
              <span>Alias / Class</span>
              <span>Schedule</span>
            </div>
            <div className="max-h-[58vh] overflow-auto">
              {filteredMeds.map((medication) => {
                const isFav = favorites.includes(medication.name);
                const aliasText = (medication.aliases || []).join(", ");
                return (
                  <button
                    type="button"
                    key={medication.name}
                    className="grid w-full grid-cols-[auto_280px_1fr_120px] items-start gap-2 border-b px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-muted"
                    onClick={() => {
                      onSelect(medication);
                      onClose();
                    }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFavorite(medication.name);
                      }}
                      title={isFav ? "Remove favorite" : "Add favorite"}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          isFav ? "fill-amber-400 text-amber-500" : "text-slate-400"
                        }`}
                      />
                    </span>
                    <span className="font-medium text-slate-900 dark:text-foreground">{medication.name}</span>
                    <span className="text-slate-700 dark:text-foreground">
                      {aliasText || MEDICATION_CATEGORY_LABELS[medication.category]}
                    </span>
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        medication.controlled
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {medication.controlled ? "Controlled" : "Standard"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-muted-foreground">
            Showing {filteredMeds.length} medications.
            {catalogBacked ? " Using full formulary search." : " Using bundled curated formulary."}
            {" "}Favorites are pinned to the top.
            {saving ? " Saving favorites..." : ""}
            {loadingCatalog ? " Loading catalog..." : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
