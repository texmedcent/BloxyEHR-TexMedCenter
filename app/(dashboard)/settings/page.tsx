import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isHospitalManager } from "@/lib/roles";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";

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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
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
            <CardTitle>Institution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-3">
              Manage user roles for your institution.
            </p>
            <Link
              href="/settings/institution"
              className="inline-flex h-9 items-center rounded-md bg-[#1a4d8c] px-3 text-sm font-medium text-white hover:bg-[#1a4d8c]/90"
            >
              Open Institution Settings
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
