"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALL_ROLES, formatRoleLabel } from "@/lib/roles";

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  department: string | null;
}

export function InstitutionRoleManager({
  initialRows,
  initialControlledSubstanceCode,
}: {
  initialRows: Row[];
  initialControlledSubstanceCode: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);
  const [controlledCode, setControlledCode] = useState(initialControlledSubstanceCode);
  const [message, setMessage] = useState<string | null>(null);

  const updateRole = async (id: string, role: string) => {
    setSavingId(id);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setSavingId(null);
    if (error) {
      setMessage(`Failed to update role: ${error.message}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role } : r)));
    setMessage("Role updated successfully.");
  };

  const saveControlledCode = async () => {
    if (!controlledCode.trim()) {
      setMessage("Controlled substance code cannot be empty.");
      return;
    }

    setSavingCode(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("institution_settings")
      .update({ controlled_substance_code: controlledCode.trim() })
      .eq("id", 1);

    setSavingCode(false);
    if (error) {
      setMessage(`Failed to update controlled substance code: ${error.message}`);
      return;
    }

    setMessage("Controlled substance code updated.");
  };

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-900">Controlled Substance Authorization</h3>
        <p className="mt-1 text-xs text-slate-500">
          Prescribers must enter this code to place controlled medication orders.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <Label htmlFor="controlled-code">Authorization Code</Label>
            <Input
              id="controlled-code"
              className="mt-1"
              value={controlledCode}
              onChange={(e) => setControlledCode(e.target.value)}
              placeholder="Enter code"
            />
          </div>
          <Button onClick={saveControlledCode} disabled={savingCode}>
            {savingCode ? "Saving..." : "Update Code"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Name</th>
              <th className="text-left px-3 py-2 font-semibold">Email</th>
              <th className="text-left px-3 py-2 font-semibold">Department</th>
              <th className="text-left px-3 py-2 font-semibold">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="px-3 py-2">{row.full_name || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{row.email || "—"}</td>
                <td className="px-3 py-2">{row.department || "—"}</td>
                <td className="px-3 py-2">
                  <select
                    value={row.role}
                    onChange={(e) => updateRole(row.id, e.target.value)}
                    className="h-8 rounded border border-slate-300 bg-white px-2 text-sm"
                    disabled={savingId === row.id}
                  >
                    {ALL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={4}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500">
        Manager changes are applied immediately.
      </div>
    </div>
  );
}
