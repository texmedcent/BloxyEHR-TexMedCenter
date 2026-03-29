import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionAndUser } from "@/lib/supabase/server";
import { HyperspaceLayout } from "@/components/layout/HyperspaceLayout";
import { ensureProfileRecord, getRoleLandingPath, isHospitalManager, resolveRoleWithBootstrap, staffMustSelectDepartment } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, userId } = await getSessionAndUser();
  if (!user || !userId) {
    redirect("/auth/login?r=layout-no-user");
  }

  const sessionEmail = user.email;
  let { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("full_name, role, department_id")
        .eq("id", userId)
        .maybeSingle()
    : { data: null };

  if (!profile) {
    const fallbackRole = resolveRoleWithBootstrap(sessionEmail ?? null, null) ?? "patient";
    const fallbackName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : sessionEmail?.split("@")[0] ?? null;
    await ensureProfileRecord(supabase, userId, sessionEmail ?? null, fallbackName, fallbackRole);
    const { data: hydrated } = await supabase
      .from("profiles")
      .select("full_name, role, department_id")
      .eq("id", userId)
      .maybeSingle();
    profile = hydrated ?? null;
  }
  const effectiveRole = resolveRoleWithBootstrap(sessionEmail ?? null, profile?.role ?? null);
  const effectiveProfile = {
    full_name: profile?.full_name ?? (sessionEmail?.split("@")[0] ?? null),
    role: effectiveRole,
    department_id: profile?.department_id ?? null,
  };

  // Only send explicit patients to the patient portal. Missing/null role must NOT default to patient —
  // that caused a redirect loop with /patient → /dashboard when role existed but was read inconsistently.
  if (effectiveProfile.role === "patient") {
    redirect(getRoleLandingPath(effectiveProfile.role));
  }

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // Hospital managers bootstrap catalog without a department; x-pathname can be missing in RSC — don't gate them.
  const needsDepartment =
    !isHospitalManager(effectiveProfile.role) &&
    staffMustSelectDepartment(effectiveProfile.role) &&
    (effectiveProfile.department_id == null || effectiveProfile.department_id === "");
  const onDepartmentSetup =
    pathname === "/settings/complete-department" || pathname.startsWith("/settings/complete-department");

  if (needsDepartment && !onDepartmentSetup) {
    redirect("/settings/complete-department");
  }

  return (
    <HyperspaceLayout
      userEmail={sessionEmail ?? undefined}
      userName={effectiveProfile.full_name ?? undefined}
      userRole={effectiveProfile.role ?? undefined}
      departmentId={effectiveProfile.department_id}
    >
      {children}
    </HyperspaceLayout>
  );
}
