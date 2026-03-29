import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { staffMustSelectDepartment } from "@/lib/roles";
import { CompleteDepartmentForm } from "@/components/settings/CompleteDepartmentForm";

export default async function CompleteDepartmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, department_id")
    .eq("id", user.id)
    .single();

  // staffMustSelectDepartment(null) is false — do not send null role to /patient (that caused a login flicker loop with /dashboard).
  if (!profile) {
    redirect("/auth/login");
  }
  if (profile.role === "patient") {
    redirect("/patient");
  }
  if (!staffMustSelectDepartment(profile.role)) {
    redirect("/staff-dashboard");
  }

  if (profile?.department_id) {
    redirect("/staff-dashboard");
  }

  const { data: departments } = await supabase
    .from("institution_departments")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto">
      <CompleteDepartmentForm departments={departments ?? []} />
    </div>
  );
}
