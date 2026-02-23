"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";

interface SafetyRow {
  id: string;
  event_type: string;
  severity: string;
  description: string;
  status: string;
  reported_by_name: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  patient_name: string;
  patient_mrn: string;
}

export function InstitutionSafetyQueue({
  initialRows,
  currentUserRole,
}: {
  initialRows: SafetyRow[];
  currentUserRole: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const canReview = hasRolePermission(currentUserRole, "review_adverse_event");

  const openCount = useMemo(
    () => rows.filter((row) => row.status === "open" || row.status === "under_review").length,
    [rows]
  );

  const updateStatus = async (row: SafetyRow, nextStatus: "under_review" | "closed") => {
    if (!canReview) return;
    setUpdatingId(row.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : { data: null };
    const nowIso = new Date().toISOString();
    const reviewerName = profile?.full_name || user?.email || "Reviewer";
    const { error } = await supabase
      .from("adverse_events")
      .update({
        status: nextStatus,
        reviewed_by: user?.id || null,
        reviewed_by_name: reviewerName,
        reviewed_at: nowIso,
      })
      .eq("id", row.id);
    setUpdatingId(null);
    if (error) return;
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: nextStatus,
              reviewed_by_name: reviewerName,
              reviewed_at: nowIso,
            }
          : item
      )
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card p-3">
        <p className="text-sm font-medium text-slate-800 dark:text-foreground">
          Safety Event Queue · {openCount} open/review events
        </p>
        {!canReview && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {formatRoleLabel(currentUserRole)} cannot review/close events.
          </p>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-foreground">When</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Patient</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Type/Severity</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Description</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 dark:border-border last:border-b-0">
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-muted-foreground">
                  {format(new Date(row.created_at), "MM/dd HH:mm")}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {row.patient_name}
                  {row.patient_mrn ? ` (${row.patient_mrn})` : ""}
                </td>
                <td className="px-3 py-2">
                  <span className="capitalize text-foreground">{row.event_type.replaceAll("_", " ")}</span>
                  <span className="ml-2 rounded bg-slate-100 dark:bg-muted px-1.5 py-0.5 text-xs capitalize">
                    {row.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700 dark:text-foreground">{row.description}</td>
                <td className="px-3 py-2">
                  <div className="text-xs">
                    <p className="capitalize">{row.status.replaceAll("_", " ")}</p>
                    {row.reviewed_by_name && (
                      <p className="text-slate-500 dark:text-muted-foreground">
                        {row.reviewed_by_name}
                        {row.reviewed_at
                          ? ` · ${format(new Date(row.reviewed_at), "MM/dd HH:mm")}`
                          : ""}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {row.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!canReview || updatingId === row.id}
                        onClick={() => updateStatus(row, "under_review")}
                      >
                        Review
                      </Button>
                    )}
                    {row.status !== "closed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!canReview || updatingId === row.id}
                        onClick={() => updateStatus(row, "closed")}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                  No safety events reported.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
