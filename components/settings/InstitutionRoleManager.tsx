"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateProfileDepartment } from "@/lib/profileDepartment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ALL_ROLES, formatRoleLabel } from "@/lib/roles";

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  department: string | null;
  department_id: string | null;
}

export type DepartmentOption = {
  id: string;
  name: string;
  is_active: boolean;
};

export function InstitutionRoleManager({
  initialRows,
  initialControlledSubstanceCode,
  initialBypassPharmacyVerification = false,
  departments,
}: {
  initialRows: Row[];
  initialControlledSubstanceCode: string;
  initialBypassPharmacyVerification?: boolean;
  departments: DepartmentOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);
  const [savingBypass, setSavingBypass] = useState(false);
  const [controlledCode, setControlledCode] = useState(initialControlledSubstanceCode);
  const [bypassPharmacyVerification, setBypassPharmacyVerification] = useState(
    initialBypassPharmacyVerification
  );
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRows = searchQuery.trim()
    ? rows.filter((row) => {
        const q = searchQuery.trim().toLowerCase();
        const name = (row.full_name ?? "").toLowerCase();
        const email = (row.email ?? "").toLowerCase();
        const dept = (row.department ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || dept.includes(q);
      })
    : rows;

  const updateRole = async (id: string, role: string) => {
    setSavingId(id);
    setMessage(null);
    const supabase = createClient();
    const patch: Record<string, unknown> = { role };
    if (role === "patient") {
      patch.department_id = null;
      patch.department = null;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      setMessage(`Failed to update role: ${error.message}`);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, role, ...(role === "patient" ? { department_id: null, department: null } : {}) } : r
      )
    );
    setMessage("Role updated successfully.");
  };

  const updateDepartment = async (id: string, nextDepartmentId: string | null) => {
    setSavingId(id);
    setMessage(null);
    const supabase = createClient();
    const result = await updateProfileDepartment(supabase, id, nextDepartmentId);
    setSavingId(null);
    if (result && typeof result === "object" && "error" in result && result.error) {
      const msg =
        typeof result.error === "object" && result.error && "message" in result.error
          ? String((result.error as { message: string }).message)
          : "Failed to update department.";
      setMessage(msg);
      return;
    }
    const name =
      nextDepartmentId && departments.find((d) => d.id === nextDepartmentId)?.name
        ? departments.find((d) => d.id === nextDepartmentId)!.name
        : null;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, department_id: nextDepartmentId, department: name } : r))
    );
    setMessage("Department updated.");
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

  const saveBypassPharmacyVerification = async () => {
    setSavingBypass(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("institution_settings")
      .update({ bypass_pharmacy_verification: bypassPharmacyVerification })
      .eq("id", 1);

    setSavingBypass(false);
    if (error) {
      setMessage(`Failed to update setting: ${error.message}`);
      return;
    }

    setMessage("Medication workflow setting updated.");
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg bg-muted px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="controlled-code" className="text-sm font-medium">Controlled Substance Authorization Code</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Required for prescribers to place controlled medication orders.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Input
              id="controlled-code"
              className="max-w-xs"
              value={controlledCode}
              onChange={(e) => setControlledCode(e.target.value)}
              placeholder="Enter code"
            />
            <Button onClick={saveControlledCode} disabled={savingCode} size="sm">
              {savingCode ? "Saving..." : "Update"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="bypass-pharmacy"
            checked={bypassPharmacyVerification}
            onCheckedChange={(checked) => setBypassPharmacyVerification(checked === true)}
          />
          <Label htmlFor="bypass-pharmacy" className="text-sm cursor-pointer">
            Bypass pharmacy verification when no pharmacist on duty
          </Label>
        </div>
        <Button variant="secondary" size="sm" onClick={saveBypassPharmacyVerification} disabled={savingBypass}>
          {savingBypass ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium mb-3">User Roles</h4>
        <div className="mb-3">
          <Input
            placeholder="Search users by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
            aria-label="Search users"
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium min-w-[200px]">Department</th>
                <th className="text-left px-4 py-2.5 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">{row.full_name || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.email || "—"}</td>
                  <td className="px-4 py-2.5">
                    {row.role === "patient" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <select
                        value={row.department_id ?? ""}
                        onChange={(e) =>
                          void updateDepartment(row.id, e.target.value ? e.target.value : null)
                        }
                        className="h-8 w-full max-w-[240px] rounded-md border border-input bg-background px-2 text-sm"
                        disabled={savingId === row.id}
                      >
                        <option value="">Select…</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id} disabled={!d.is_active}>
                            {d.name}
                            {!d.is_active ? " (inactive)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={row.role}
                      onChange={(e) => void updateRole(row.id, e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      disabled={savingId === row.id}
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {formatRoleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Changes apply immediately.</p>
      </div>
    </div>
  );
}
