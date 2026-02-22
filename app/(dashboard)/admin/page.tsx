import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Activity,
  Calendar,
  Users,
  ClipboardList,
  FlaskConical,
  AlertTriangle,
  Pill,
  ShieldAlert,
  Inbox,
  Building2,
  UserCog,
  FileText,
  MessageSquare,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isHospitalManager } from "@/lib/roles";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims as { sub?: string } | undefined)?.sub;

  if (!userId) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!isHospitalManager(profile?.role)) {
    redirect("/dashboard");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    { count: activeEncounterCount },
    { count: todayAppointmentCount },
    { count: staffCount },
    { count: orders24hCount },
    { count: results24hCount },
    pharmacyVerifResult,
    adverseEventsResult,
    inBasketTasksResult,
    criticalResultsResult,
  ] = await Promise.all([
    supabase.from("encounters").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("slot_start", todayStart.toISOString())
      .lte("slot_start", todayEnd.toISOString()),
    supabase.from("profiles").select("*", { count: "exact", head: true }).neq("role", "patient"),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("ordered_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("results")
      .select("*", { count: "exact", head: true })
      .gte("reported_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("type", "med")
      .or("is_controlled_substance.eq.true,high_risk_med.eq.true")
      .in("status", ["pending", "active", "held"])
      .is("pharmacy_verified_at", null),
    supabase
      .from("adverse_events")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed"),
    supabase
      .from("in_basket_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .eq("is_critical", true)
      .or("acknowledgment_status.eq.new,acknowledgment_status.is.null"),
  ]);

  const pharmacyVerifCount = pharmacyVerifResult.count ?? 0;
  const adverseEventsCount = adverseEventsResult.count ?? 0;
  const inBasketCount = inBasketTasksResult.count ?? 0;
  const criticalResultsCount = criticalResultsResult.count ?? 0;

  return (
    <div className="space-y-10 w-full px-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 text-slate-900 dark:text-foreground">
          <Building2 className="h-6 w-6 text-primary shrink-0" />
          Administrator Panel
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Operational overview and quick access to institution settings.
        </p>
      </div>

      {/* Operational Overview */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 dark:text-foreground mb-4">Operational Overview</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card className="border-slate-200 dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Active Encounters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                {activeEncounterCount ?? 0}
              </div>
              <Link
                href="/chart"
                className="text-xs text-[#1a4d8c] dark:text-primary hover:underline mt-1 inline-block"
              >
                View chart
              </Link>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                <Calendar className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
                Today&apos;s Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                {todayAppointmentCount ?? 0}
              </div>
              <Link
                href="/schedule"
                className="text-xs text-[#1a4d8c] dark:text-primary hover:underline mt-1 inline-block"
              >
                View schedule
              </Link>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                <Users className="h-4 w-4 text-slate-600 dark:text-muted-foreground" />
                Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                {staffCount ?? 0}
              </div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Non-patient profiles</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Orders (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                {orders24hCount ?? 0}
              </div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Last 24 hours</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 dark:border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                <FlaskConical className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
                Results (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                {results24hCount ?? 0}
              </div>
              <Link
                href="/results"
                className="text-xs text-[#1a4d8c] dark:text-primary hover:underline mt-1 inline-block"
              >
                View results
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pending Items */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 dark:text-foreground mb-4">Pending Items</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/pharmacist">
            <Card className="border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                  <Pill className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Pharmacy Verifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                  {pharmacyVerifCount}
                </div>
                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Pending pharmacist review</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/settings/institution#safety">
            <Card className="border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  Open Adverse Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                  {adverseEventsCount}
                </div>
                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Awaiting review</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/inbasket">
            <Card className="border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                  <Inbox className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
                  Open Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                  {inBasketCount}
                </div>
                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">In basket (org-wide)</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/results">
            <Card className="border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-foreground">
                  <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                  Critical Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-900 dark:text-foreground">
                  {criticalResultsCount}
                </div>
                <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Unacknowledged</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Quick Admin Links */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 dark:text-foreground mb-4">Quick Admin Links</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Link href="/settings/institution">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-4 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <UserCog className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-foreground">User Roles & Medication Settings</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Assign roles, controlled substance code, pharmacy bypass</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </Link>
          <Link href="/settings/institution">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-4 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-foreground">Audit Trail</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Patient and operational admin actions</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </Link>
          <Link href="/settings/institution">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-4 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-foreground">Safety Queue</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Review and close adverse events</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </Link>
          <Link href="/settings/institution">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-4 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-foreground">ICD-10 Catalog</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Custom diagnosis entries</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </Link>
          <Link href="/settings/institution">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-5 py-4 hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-foreground">Department Chat Groups</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Create channels and manage staff access</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
          </Link>
        </div>
      </div>

      {/* Full Institution Settings */}
      <Card className="border-slate-200 dark:border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Full Institution Settings
          </CardTitle>
          <CardDescription>Manage all organizational settings in one place.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/institution"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Open Institution Settings
            <ChevronRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
