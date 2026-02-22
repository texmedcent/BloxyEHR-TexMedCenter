"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { formatRoleLabel } from "@/lib/roles";

interface AccountSettingsFormProps {
  userId: string;
  initialFullName: string | null;
  initialDepartment: string | null;
  initialSignature: string | null;
  email: string | null;
  role: string | null;
}

export function AccountSettingsForm({
  userId,
  initialFullName,
  initialDepartment,
  initialSignature,
  email,
  role,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [department, setDepartment] = useState(initialDepartment ?? "");
  const [signature, setSignature] = useState(initialSignature ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveSettings = async () => {
    if (!fullName.trim()) {
      setError("Name is required.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        department: department.trim() || null,
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
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1"
              placeholder="e.g. Emergency, Radiology"
            />
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
