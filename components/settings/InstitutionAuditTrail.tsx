"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AuditRow {
  id: string;
  table_name: string;
  action: string;
  changed_fields: unknown;
  performed_by_name: string | null;
  performed_at: string;
  patient_name: string;
  patient_mrn: string;
}

export function InstitutionAuditTrail({ initialRows }: { initialRows: AuditRow[] }) {
  const [query, setQuery] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [minimized, setMinimized] = useState(false);

  const tableOptions = useMemo(() => {
    const set = new Set(initialRows.map((r) => r.table_name));
    return ["all", ...Array.from(set).sort()];
  }, [initialRows]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialRows.filter((r) => {
      if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
      if (!q) return true;
      return (
        r.patient_name.toLowerCase().includes(q) ||
        r.patient_mrn.toLowerCase().includes(q) ||
        r.table_name.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.performed_by_name || "").toLowerCase().includes(q)
      );
    });
  }, [initialRows, query, tableFilter]);

  const formatChangedFields = (value: unknown) => {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }
    return "—";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium text-slate-700">
          {minimized ? "Audit Trail is minimized" : "Audit Trail Filters"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setMinimized((v) => !v)}
        >
          {minimized ? "Expand Audit Trail" : "Minimize Audit Trail"}
        </Button>
      </div>

      {!minimized && (
        <>
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_220px]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient, MRN, action, user..."
          />
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="h-9 rounded border border-slate-300 bg-white px-2 text-sm"
          >
            {tableOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All Modules" : option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Time</th>
              <th className="px-3 py-2 text-left font-semibold">Patient</th>
              <th className="px-3 py-2 text-left font-semibold">Module</th>
              <th className="px-3 py-2 text-left font-semibold">Action</th>
              <th className="px-3 py-2 text-left font-semibold">Changed Fields</th>
              <th className="px-3 py-2 text-left font-semibold">Performed By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="px-3 py-2 text-slate-600">
                  {format(new Date(row.performed_at), "MM/dd/yyyy HH:mm:ss")}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{row.patient_name || "Unknown patient"}</div>
                  <div className="text-xs text-slate-500">{row.patient_mrn || "MRN —"}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.table_name}</td>
                <td className="px-3 py-2 capitalize">{row.action}</td>
                <td className="max-w-[280px] px-3 py-2 text-xs text-slate-600">
                  {formatChangedFields(row.changed_fields)}
                </td>
                <td className="px-3 py-2">{row.performed_by_name || "System"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                  No audit events found for current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
