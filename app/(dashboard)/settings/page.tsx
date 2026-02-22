import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Building2, ChevronRight } from "lucide-react";
import { isHospitalManager } from "@/lib/roles";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { ThemeSettings } from "@/components/settings/ThemeSettings";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;
  const userId = claims?.sub;
  let role: string | null = null;
  let fullName: string | null = null;
  let department: string | null = null;
  let signature: string | null = null;
  let email: string | null = null;

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, department, signature, email")
      .eq("id", userId)
      .single();
    role = profile?.role ?? null;
    fullName = profile?.full_name ?? null;
    department = profile?.department ?? null;
    signature = profile?.signature ?? null;
    email = profile?.email ?? claims?.email ?? null;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary shrink-0" />
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">Manage your account and preferences.</p>
      </div>

      <ThemeSettings />
      {userId && (
        <AccountSettingsForm
          userId={userId}
          initialFullName={fullName}
          initialDepartment={department}
          initialSignature={signature}
          email={email}
          role={role}
        />
      )}

      {isHospitalManager(role) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Institution
            </CardTitle>
            <CardDescription>Manage roles, audit logs, safety queue, and more.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/institution"
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Open Institution Settings
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
