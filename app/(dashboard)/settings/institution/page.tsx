import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InstitutionRoleManager } from "@/components/settings/InstitutionRoleManager";
import { isHospitalManager } from "@/lib/roles";

export default async function InstitutionSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims as { sub?: string } | undefined)?.sub;

  if (!userId) {
    redirect("/auth/login");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!isHospitalManager(currentProfile?.role)) {
    redirect("/settings");
  }

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department")
    .order("created_at", { ascending: false });

  const { data: institutionSettings } = await supabase
    .from("institution_settings")
    .select("controlled_substance_code")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Institution</h1>
      <p className="text-sm text-slate-600">
        Manage role assignments for users in your hospital.
      </p>
      <InstitutionRoleManager
        initialRows={rows || []}
        initialControlledSubstanceCode={institutionSettings?.controlled_substance_code || ""}
      />
    </div>
  );
}
