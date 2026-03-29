"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateProfileDepartments } from "@/lib/profileDepartment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, User } from "lucide-react";
import { formatRoleLabel, staffMustSelectDepartment } from "@/lib/roles";

type DepartmentOption = { id: string; name: string };

interface AccountSettingsFormProps {
  userId: string;
  initialFullName: string | null;
  initialDepartmentId: string | null;
  initialDepartmentIds: string[];
  initialSignature: string | null;
  email: string | null;
  role: string | null;
  departments: DepartmentOption[];
}

export function AccountSettingsForm({
  userId,
  initialFullName,
  initialDepartmentId,
  initialDepartmentIds,
  initialSignature,
  email,
  role,
  departments,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const initialSelectedDepartments =
    initialDepartmentIds.length > 0 ? initialDepartmentIds.slice(0, 3) : initialDepartmentId ? [initialDepartmentId] : [];
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(initialSelectedDepartments);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState(
    initialDepartmentId && initialSelectedDepartments.includes(initialDepartmentId)
      ? initialDepartmentId
      : initialSelectedDepartments[0] ?? ""
  );
  const [signature, setSignature] = useState(initialSignature ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [departmentPickerOpen, setDepartmentPickerOpen] = useState(false);

  const staffDept = staffMustSelectDepartment(role);

  const toggleDepartment = (nextId: string, checked: boolean) => {
    if (checked) {
      if (selectedDepartmentIds.includes(nextId)) return;
      if (selectedDepartmentIds.length >= 3) {
        setError("You can select up to 3 departments.");
        setMessage(null);
        return;
      }
      const next = [...selectedDepartmentIds, nextId];
      setSelectedDepartmentIds(next);
      if (!primaryDepartmentId) setPrimaryDepartmentId(nextId);
      setError(null);
      return;
    }

    const next = selectedDepartmentIds.filter((id) => id !== nextId);
    setSelectedDepartmentIds(next);
    if (primaryDepartmentId === nextId) {
      setPrimaryDepartmentId(next[0] ?? "");
    }
  };

  const saveSettings = async () => {
    if (!fullName.trim()) {
      setError("Name is required.");
      setMessage(null);
      return;
    }
    if (staffDept && selectedDepartmentIds.length === 0) {
      setError("Select at least one department.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (staffDept) {
      const safePrimary = primaryDepartmentId || selectedDepartmentIds[0] || "";
      const deptResult = await updateProfileDepartments(
        supabase,
        userId,
        selectedDepartmentIds,
        safePrimary
      );
      if (deptResult && typeof deptResult === "object" && "error" in deptResult && deptResult.error) {
        setSaving(false);
        setError(
          typeof deptResult.error === "object" && deptResult.error && "message" in deptResult.error
            ? String((deptResult.error as { message: string }).message)
            : "Could not update department."
        );
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        signature: signature.trim() || null,
      })
      .eq("id", userId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Settings saved.");
    router.refresh();
  };

  const selectedDepartmentNames = departments
    .filter((department) => selectedDepartmentIds.includes(department.id))
    .map((department) => department.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Account
        </CardTitle>
        <CardDescription>Your profile and display preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="full_name">Name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1"
              placeholder="Your display name"
            />
            <p className="mt-1 text-xs text-slate-500">
              This updates the name shown in the top-right user menu.
            </p>
          </div>

          <div>
            <Label>Departments (up to 3)</Label>
            {staffDept ? (
              <Popover open={departmentPickerOpen} onOpenChange={setDepartmentPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="mt-1 w-full justify-between font-normal">
                    <span className="truncate text-left">
                      {selectedDepartmentNames.length > 0
                        ? selectedDepartmentNames.join(", ")
                        : "Select departments..."}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[420px] max-w-[calc(100vw-2rem)] p-3">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Selected {selectedDepartmentIds.length}/3
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-border p-1">
                      {departments.map((d) => {
                        const checked = selectedDepartmentIds.includes(d.id);
                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-muted/40"
                          >
                            <label className="inline-flex items-center gap-2 text-sm cursor-pointer min-w-0 flex-1">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => toggleDepartment(d.id, Boolean(value))}
                              />
                              <span className="truncate">{d.name}</span>
                            </label>
                            <label className="inline-flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                              <input
                                type="radio"
                                name="primaryDepartment"
                                checked={checked && primaryDepartmentId === d.id}
                                disabled={!checked}
                                onChange={() => setPrimaryDepartmentId(d.id)}
                              />
                              Primary
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDepartmentPickerOpen(false)}>
                        Done
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Input
                id="department"
                value="—"
                disabled
                className="mt-1 bg-slate-50 dark:bg-muted"
              />
            )}
            <p className="mt-1 text-xs text-slate-500">
              {staffDept
                ? "Pick up to 3 departments and choose a primary one. The primary department is used by existing scheduling/task flows."
                : "Department applies to clinical staff."}
            </p>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="signature">Documentation Signature</Label>
            <Input
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="mt-1"
              placeholder="e.g. D. Schlossberg, MD"
            />
            <p className="mt-1 text-xs text-slate-500">
              Used at the bottom of signed clinical notes.
            </p>
          </div>

          <div>
            <Label>Email</Label>
            <Input value={email ?? ""} disabled className="mt-1 bg-slate-50 dark:bg-muted" />
          </div>

          <div>
            <Label>Role</Label>
            <Input value={formatRoleLabel(role)} disabled className="mt-1 bg-slate-50 dark:bg-muted" />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

        <div className="flex justify-end pt-2">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
