"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export type CampusRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export function InstitutionCampusesManager({
  initialRows,
  tableReady = true,
  tableError = null,
}: {
  initialRows: CampusRow[];
  tableReady?: boolean;
  tableError?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [newName, setNewName] = useState("");
  const [newSort, setNewSort] = useState(100);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const addCampus = async () => {
    if (!tableReady) {
      setMessage("Campus table is not available yet. Run migrations, then try again.");
      return;
    }
    const name = newName.trim();
    if (!name) {
      setMessage("Enter a campus name.");
      return;
    }
    setBusy("add");
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("institution_campuses")
      .insert({ name, sort_order: newSort, is_active: true })
      .select("id, name, sort_order, is_active")
      .single();
    setBusy(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data) {
      setRows((prev) =>
        [...prev, data].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      );
    }
    setNewName("");
    setMessage("Campus added. Inpatient and outpatient check-in/encounter options are now available for it.");
    refresh();
  };

  const saveRow = async (row: CampusRow) => {
    if (!tableReady) {
      setMessage("Campus table is not available yet. Run migrations, then try again.");
      return;
    }
    setBusy(row.id);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("institution_campuses")
      .update({
        name: row.name.trim(),
        sort_order: row.sort_order,
        is_active: row.is_active,
      })
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Saved.");
    refresh();
  };

  const updateLocal = (id: string, patch: Partial<CampusRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm" role="status">
          {message}
        </div>
      )}
      {!tableReady && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900" role="status">
          Campus storage is not initialized in Supabase yet.
          {tableError ? ` (${tableError})` : ""}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h4 className="text-sm font-medium">Add campus location</h4>
        <p className="text-xs text-muted-foreground">
          Each campus location automatically supports both outpatient and inpatient encounter/check-in flows.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="new-campus-name">Campus name</Label>
            <Input
              id="new-campus-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Texas Medical Center Univ. Hospital"
              className="mt-1"
              disabled={!tableReady}
            />
          </div>
          <div className="w-24">
            <Label htmlFor="new-campus-sort">Sort</Label>
            <Input
              id="new-campus-sort"
              type="number"
              value={newSort}
              onChange={(e) => setNewSort(Number(e.target.value) || 0)}
              className="mt-1"
              disabled={!tableReady}
            />
          </div>
          <Button type="button" onClick={() => void addCampus()} disabled={!tableReady || busy === "add"}>
            {busy === "add" ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Campus</th>
              <th className="text-left px-3 py-2 font-medium w-24">Sort</th>
              <th className="text-left px-3 py-2 font-medium">Active</th>
              <th className="text-right px-3 py-2 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <Input
                    value={row.name}
                    onChange={(e) => updateLocal(row.id, { name: e.target.value })}
                    className="h-8"
                    disabled={!tableReady}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={row.sort_order}
                    onChange={(e) => updateLocal(row.id, { sort_order: Number(e.target.value) || 0 })}
                    className="h-8 w-20"
                    disabled={!tableReady}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`active-campus-${row.id}`}
                      checked={row.is_active}
                      onCheckedChange={(c) => updateLocal(row.id, { is_active: c === true })}
                      disabled={!tableReady}
                    />
                    <Label htmlFor={`active-campus-${row.id}`} className="text-xs cursor-pointer">
                      {row.is_active ? "Shown in lists" : "Hidden"}
                    </Label>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!tableReady || busy === row.id}
                    onClick={() => void saveRow(row)}
                  >
                    {busy === row.id ? "…" : "Save"}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No campus locations yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
