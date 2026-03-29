"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateProfileDepartment } from "@/lib/profileDepartment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";

type Dept = { id: string; name: string };

export function CompleteDepartmentForm({ departments }: { departments: Dept[] }) {
  const [departmentId, setDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!departmentId) {
      setError("Select the department you work in.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("Not signed in.");
      return;
    }
    const res = await updateProfileDepartment(supabase, user.id, departmentId);
    setSaving(false);
    if (res.error) {
      setError(res.error.message || "Could not save.");
      return;
    }
    window.location.assign("/staff-dashboard");
  };

  if (departments.length === 0) {
    return (
      <Card className="max-w-md mx-auto border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle>No departments yet</CardTitle>
          <CardDescription>
            A hospital manager must add departments under Settings → Institution Settings → Departments before you can continue.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto border-border shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Building2 className="h-6 w-6 text-primary" />
          Your department
        </CardTitle>
        <CardDescription>
          Select where you primarily work. You can change this anytime in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="dept">Department</Label>
          <select
            id="dept"
            className="mt-1 w-full rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
          >
            <option value="">Choose department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" className="w-full" onClick={() => void submit()} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
