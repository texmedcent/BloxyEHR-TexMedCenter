"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MEDICATION_CATEGORIES,
  MEDICATION_CATEGORY_LABELS,
  MEDICATION_FORMULARY_DEDUPED,
  searchMedications,
  type MedicationCategory,
  type MedicationItem,
} from "@/lib/medications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Star, X } from "lucide-react";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      const raw = profile?.medication_favorites;
      const list = Array.isArray(raw)
        ? (raw as unknown[])
            .map((x) => (typeof x === "string" ? x.trim() : ""))
            .filter(Boolean)
        : [];
      setFavorites(list);
    };
    void loadFavorites();
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setCategory("all");
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filteredMeds = useMemo(
    () => searchMedications(MEDICATION_FORMULARY_DEDUPED, search, category, favorites),
    [category, favorites, search],
  );

  const persistFavorites = useCallback(
    async (next: string[]) => {
      if (!userId) return;
      setSaving(true);
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("profiles")
          .update({ medication_favorites: next })
          .eq("id", userId);
        if (error) console.error("Failed to save favorites:", error);
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  const toggleFavorite = useCallback(
    async (name: string) => {
      const next = favorites.includes(name)
        ? favorites.filter((item) => item !== name)
        : [name, ...favorites];
      setFavorites(next);
      await persistFavorites(next);
    },
    [favorites, persistFavorites],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  const clearSearch = useCallback(() => {
    setSearch("");
    searchInputRef.current?.focus();
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onKeyDown={handleKeyDown}
    >
      <Card className="flex max-h-[90vh] w-full max-w-5xl flex-col" role="dialog" aria-labelledby="med-picker-title">
        <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-4">
          <CardTitle id="med-picker-title">Medication Picker</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 overflow-hidden">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search by name or brand (e.g. "zofran", "ceftriaxone", "norco")'
                className="pl-9 pr-9"
                aria-label="Search medications"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MedicationCategory)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Filter by category"
            >
              {MEDICATION_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {MEDICATION_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[auto_200px_1fr_100px] border-b bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
              <span className="w-8" aria-hidden>Fav</span>
              <span>Medication</span>
              <span className="hidden sm:inline">Alias / Class</span>
              <span className="text-right">Type</span>
            </div>
            <div className="max-h-[58vh] overflow-auto">
              {filteredMeds.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="font-medium">No medications found</p>
                  <p className="mt-1 text-sm">
                    {search.trim()
                      ? 'Try a different search term or clear the search. Use generic name or brand (e.g. "Zofran", "Rocephin").'
                      : "Select a category to browse, or type to search."}
                  </p>
                  {search && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={clearSearch}>
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                filteredMeds.map((medication) => {
                  const isFav = favorites.includes(medication.name);
                  const aliasText = (medication.aliases ?? []).join(", ");
                  return (
                    <button
                      type="button"
                      key={medication.name}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[auto_200px_1fr_100px] items-center gap-2 border-b border-border/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 last:border-0"
                      onClick={() => {
                        onSelect(medication);
                        onClose();
                      }}
                    >
                      <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleFavorite(medication.name);
                        }}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                          }`}
                        />
                      </span>
                      <span className="truncate font-medium">{medication.name}</span>
                      <span className="truncate text-muted-foreground hidden sm:block">
                        {aliasText || MEDICATION_CATEGORY_LABELS[medication.category]}
                      </span>
                      <span
                        className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                          medication.controlled
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        }`}
                      >
                        {medication.controlled ? "Controlled" : "Standard"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filteredMeds.length} of {MEDICATION_FORMULARY_DEDUPED.length} medications.
            {search.trim() && " Multi-word search: each term must match. "}
            Favorites appear first. {saving ? "Saving…" : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
