import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HyperspaceLayout } from "@/components/layout/HyperspaceLayout";
import { getRoleLandingPath } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { email?: string } | undefined;

  if (!claims) {
    redirect("/auth/login");
  }

  const userId = (claims as { sub?: string })?.sub;
  const { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", userId)
        .single()
    : { data: null };

  if (!profile?.role) {
    redirect("/patient");
  }

  if (profile.role === "patient") {
    redirect(getRoleLandingPath(profile.role));
  }

  return (
    <HyperspaceLayout
      userEmail={claims.email}
      userName={profile?.full_name ?? undefined}
    >
      {children}
    </HyperspaceLayout>
  );
}
