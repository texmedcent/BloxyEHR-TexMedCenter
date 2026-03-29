import Link from "next/link";
import { getSessionAndUser } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Building2, ChevronRight, Palette, UserCog, Shield } from "lucide-react";
import { formatRoleLabel, isHospitalManager } from "@/lib/roles";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";

export default async function SettingsPage() {
  const { supabase, userId, user } = await getSessionAndUser();
  let role: string | null = null;
  let fullName: string | null = null;
  let signature: string | null = null;
  let email: string | null = null;

  let departmentOptions: { id: string; name: string }[] = [];
  let initialDepartmentId: string | null = null;
  let initialDepartmentIds: string[] = [];

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, department, department_id, signature, email")
      .eq("id", userId)
      .single();
    role = profile?.role ?? null;
    fullName = profile?.full_name ?? null;
    initialDepartmentId = profile?.department_id ?? null;
    signature = profile?.signature ?? null;
    email = profile?.email ?? user?.email ?? null;

    const { data: deptRows } = await supabase
      .from("institution_departments")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    departmentOptions = deptRows ?? [];

    const { data: assignedDepartments } = await supabase
      .from("profile_departments")
      .select("department_id, is_primary, created_at")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    const assignedIds = (assignedDepartments || []).map((row) => row.department_id).filter(Boolean);
    initialDepartmentIds = assignedIds;
    if (!initialDepartmentId && assignedIds.length > 0) {
      initialDepartmentId = assignedIds[0];
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary shrink-0" />
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">Manage your account and preferences.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              {formatRoleLabel(role)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Department Catalog</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              {departmentOptions.length} active
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Account Email</p>
            <p className="mt-1 truncate text-sm font-medium">{email ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <CollapsiblePanel
        title="Account Profile"
        description="Name, signature, department selection, and identity details."
        defaultOpen
        summaryRight={<UserCog className="h-4 w-4 text-muted-foreground" />}
      >
        {userId ? (
          <AccountSettingsForm
            userId={userId}
            initialFullName={fullName}
            initialDepartmentId={initialDepartmentId}
            initialDepartmentIds={initialDepartmentIds}
            initialSignature={signature}
            email={email}
            role={role}
            departments={departmentOptions}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Sign in to edit your settings.</p>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Appearance"
        description="Theme preferences saved across sessions."
        defaultOpen
        summaryRight={<Palette className="h-4 w-4 text-muted-foreground" />}
      >
        <ThemeSettings />
      </CollapsiblePanel>

      {isHospitalManager(role) ? (
        <CollapsiblePanel
          title="Institution Controls"
          description="Manager-only controls for roles, departments, safety queue, and audits."
          defaultOpen
          summaryRight={<Building2 className="h-4 w-4 text-primary" />}
        >
          <Link
            href="/settings/institution"
            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Open Institution Settings
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CollapsiblePanel>
      ) : null}
    </div>
  );
}
