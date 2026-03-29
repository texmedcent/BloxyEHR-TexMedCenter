import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, FileText, ListChecks, MessageSquare, ShieldAlert, Users } from "lucide-react";
import { getSessionAndUser } from "@/lib/supabase/server";
import { InstitutionRoleManager } from "@/components/settings/InstitutionRoleManager";
import { InstitutionAuditTrail } from "@/components/settings/InstitutionAuditTrail";
import { InstitutionSafetyQueue } from "@/components/settings/InstitutionSafetyQueue";
import { InstitutionChatGroupsManager } from "@/components/settings/InstitutionChatGroupsManager";
import { InstitutionIcd10Manager } from "@/components/settings/InstitutionIcd10Manager";
import { InstitutionDepartmentsManager } from "@/components/settings/InstitutionDepartmentsManager";
import { InstitutionCampusesManager } from "@/components/settings/InstitutionCampusesManager";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import { PRESET_INSTITUTION_DEPARTMENTS } from "@/lib/institutionDepartments";
import { ensureProfileRecord, isHospitalManager, resolveRoleWithBootstrap } from "@/lib/roles";
import { ICD10_CODES, inferIcd10Category } from "@/lib/icd10";

export default async function InstitutionSettingsPage() {
  const { supabase, userId, user } = await getSessionAndUser();

  if (!userId) {
    redirect("/auth/login");
  }

  let { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (!currentProfile) {
    const sessionEmail = user?.email ?? null;
    const fallbackRole = resolveRoleWithBootstrap(sessionEmail, null) ?? "patient";
    const fallbackName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : sessionEmail?.split("@")[0] ?? null;
    await ensureProfileRecord(supabase, userId, sessionEmail, fallbackName, fallbackRole);
    const { data: hydratedCurrent } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    currentProfile = hydratedCurrent ?? null;
  }

  if (!isHospitalManager(currentProfile?.role)) {
    redirect("/settings");
  }

  let rows: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    department: string | null;
    department_id: string | null;
  }> = [];

  const profileSelectVariants = [
    "id, email, full_name, role, department, department_id",
    "id, full_name, role, department, department_id",
    "id, email, full_name, role, department",
    "id, full_name, role, department",
  ] as const;

  for (const selectClause of profileSelectVariants) {
    const { data, error } = await supabase
      .from("profiles")
      .select(selectClause)
      .order("created_at", { ascending: false });
    if (error) continue;
    const safeRows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    rows = safeRows.map((mapped) => {
      return {
        id: String(mapped.id ?? ""),
        email: (mapped.email as string | null | undefined) ?? null,
        full_name: (mapped.full_name as string | null | undefined) ?? null,
        role: (mapped.role as string | null | undefined) ?? "patient",
        department: (mapped.department as string | null | undefined) ?? null,
        department_id: (mapped.department_id as string | null | undefined) ?? null,
      };
    });
    break;
  }

  if (rows.length === 0) {
    const sessionEmail = user?.email ?? null;
    const fallbackRole = resolveRoleWithBootstrap(sessionEmail, currentProfile?.role ?? null) ?? "patient";
    const fallbackName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : sessionEmail?.split("@")[0] ?? null;
    await ensureProfileRecord(supabase, userId, sessionEmail, fallbackName, fallbackRole);
    const { data: hydratedRows } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, department")
      .order("created_at", { ascending: false });
    rows = (hydratedRows ?? []).map((row) => ({
      id: row.id,
      email: row.email ?? null,
      full_name: row.full_name ?? null,
      role: row.role ?? "patient",
      department: row.department ?? null,
      department_id: null,
    }));
  }

  // Never render an empty role table for an authenticated manager.
  if (rows.length === 0) {
    rows = [
      {
        id: userId,
        email: user?.email ?? null,
        full_name:
          typeof user?.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : user?.email?.split("@")[0] ?? null,
        role: resolveRoleWithBootstrap(user?.email ?? null, currentProfile?.role ?? null) ?? "hospital_manager",
        department: null,
        department_id: null,
      },
    ];
  }

  let { data: departmentCatalog, error: departmentCatalogError } = await supabase
    .from("institution_departments")
    .select("id, name, sort_order, is_active")
    .order("sort_order", { ascending: true });

  // If the table exists but is empty, seed canonical presets for managers.
  if (!departmentCatalogError && (departmentCatalog?.length ?? 0) === 0) {
    await supabase.from("institution_departments").insert(PRESET_INSTITUTION_DEPARTMENTS);
    const { data: reseeded, error: reseedError } = await supabase
      .from("institution_departments")
      .select("id, name, sort_order, is_active")
      .order("sort_order", { ascending: true });
    departmentCatalog = reseeded ?? [];
    departmentCatalogError = reseedError ?? null;
  }

  const tableReady = !departmentCatalogError;
  const fallbackPresetRows = PRESET_INSTITUTION_DEPARTMENTS.map((d, i) => ({
    id: `preset-${i}`,
    name: d.name,
    sort_order: d.sort_order,
    is_active: d.is_active,
  }));
  const effectiveDepartmentCatalog = tableReady
    ? (departmentCatalog ?? [])
    : fallbackPresetRows;

  const { data: institutionSettings } = await supabase
    .from("institution_settings")
    .select("controlled_substance_code, bypass_pharmacy_verification")
    .eq("id", 1)
    .maybeSingle();

  const { data: chatGroups } = await supabase
    .from("employee_chat_groups")
    .select("id, name, department_key, is_active")
    .order("name", { ascending: true });

  const { data: chatGroupMembers } = await supabase
    .from("employee_chat_group_members")
    .select("group_id, user_id, role_in_group");
  let { data: icdRows } = await supabase
    .from("icd10_catalog")
    .select("code, label, category_key, is_active")
    .eq("is_active", true)
    .order("code", { ascending: true })
    .limit(120);

  // Keep ICD-10 catalog non-empty with bundled baseline codes.
  if ((icdRows?.length ?? 0) === 0) {
    const baselineCodes = ICD10_CODES.map((row) => ({
      code: row.code,
      label: row.label,
      category_key: inferIcd10Category(row.code),
      is_billable: true,
      is_active: true,
    }));
    await supabase.from("icd10_catalog").upsert(baselineCodes, { onConflict: "code" });
    const { data: reseededIcdRows } = await supabase
      .from("icd10_catalog")
      .select("code, label, category_key, is_active")
      .eq("is_active", true)
      .order("code", { ascending: true })
      .limit(120);
    icdRows = reseededIcdRows ?? [];
  }

  const { data: auditRows } = await supabase
    .from("patient_audit_log")
    .select("id, patient_id, table_name, action, changed_fields, performed_by_name, performed_at")
    .order("performed_at", { ascending: false })
    .limit(300);
  const { data: chatAdminAuditRows } = await supabase
    .from("chat_admin_audit_log")
    .select("id, group_id, affected_user_id, action, details, actor_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: safetyRows } = await supabase
    .from("adverse_events")
    .select(
      "id, patient_id, event_type, severity, description, status, reported_by_name, reviewed_by_name, reviewed_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const auditPatientIds = [
    ...new Set((auditRows || []).map((r) => r.patient_id).filter(Boolean)),
  ] as string[];
  const { data: auditPatients } =
    auditPatientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, first_name, last_name, mrn")
          .in("id", auditPatientIds)
      : { data: [] };
  const auditPatientMap = new Map((auditPatients || []).map((p) => [p.id, p]));

  const safetyPatientIds = [
    ...new Set((safetyRows || []).map((r) => r.patient_id).filter(Boolean)),
  ] as string[];
  const { data: safetyPatients } =
    safetyPatientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, first_name, last_name, mrn")
          .in("id", safetyPatientIds)
      : { data: [] };
  const safetyPatientMap = new Map((safetyPatients || []).map((p) => [p.id, p]));

  const mappedPatientAuditRows = (auditRows || []).map((row) => {
    const patient = row.patient_id ? auditPatientMap.get(row.patient_id) : null;
    return {
      id: row.id,
      table_name: row.table_name,
      action: row.action,
      changed_fields: row.changed_fields,
      performed_by_name: row.performed_by_name,
      performed_at: row.performed_at,
      patient_name: patient ? `${patient.last_name}, ${patient.first_name}` : "Unknown patient",
      patient_mrn: patient?.mrn || "",
    };
  });
  const mappedChatAdminAuditRows = (chatAdminAuditRows || []).map((row) => ({
    id: row.id,
    table_name: "chat_admin",
    action: row.action,
    changed_fields: row.details,
    performed_by_name: row.actor_name,
    performed_at: row.created_at,
    patient_name: "Operational action",
    patient_mrn: row.group_id ? `Group ${row.group_id.slice(0, 8)}` : "",
  }));
  const mappedAuditRows = [...mappedPatientAuditRows, ...mappedChatAdminAuditRows].sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
  );

  const mappedSafetyRows = (safetyRows || []).map((row) => {
    const patient = row.patient_id ? safetyPatientMap.get(row.patient_id) : null;
    return {
      id: row.id,
      event_type: row.event_type,
      severity: row.severity,
      description: row.description,
      status: row.status,
      reported_by_name: row.reported_by_name,
      reviewed_by_name: row.reviewed_by_name,
      reviewed_at: row.reviewed_at,
      created_at: row.created_at,
      patient_name: patient ? `${patient.last_name}, ${patient.first_name}` : "Unknown patient",
      patient_mrn: patient?.mrn || "",
    };
  });

  const activeDepartmentCount = effectiveDepartmentCatalog.filter((d) => d.is_active).length;

  const { data: campusCatalog, error: campusCatalogError } = await supabase
    .from("institution_campuses")
    .select("id, name, sort_order, is_active")
    .order("sort_order", { ascending: true });
  const campusTableReady = !campusCatalogError;
  const effectiveCampusCatalog = campusCatalog ?? [];
  const activeCampusCount = effectiveCampusCatalog.filter((c) => c.is_active).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to Settings"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary shrink-0" />
            Institution Settings
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">Manage roles, audit logs, and organizational settings.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Users</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-5 w-5 text-primary" />
            {rows.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Departments</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <ListChecks className="h-5 w-5 text-primary" />
            {activeDepartmentCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Safety Items</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            {mappedSafetyRows.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Campuses</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            {activeCampusCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-border dark:bg-card">
          <p className="text-xs text-muted-foreground">Recent Audit Events</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-5 w-5 text-primary" />
            {mappedAuditRows.length}
          </p>
        </div>
      </div>

      <CollapsiblePanel
        title="Campus Locations"
        description="Manage campus names used for encounters and patient check-ins. Each campus supports outpatient and inpatient settings."
        defaultOpen
        summaryRight={
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {effectiveCampusCatalog.length} total
          </span>
        }
      >
        <InstitutionCampusesManager
          initialRows={effectiveCampusCatalog}
          tableReady={campusTableReady}
          tableError={campusCatalogError?.message ?? null}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="User Roles & Medication Settings"
        description="Assign staff roles, departments, and controlled medication workflow settings."
        defaultOpen
        summaryRight={<span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{rows.length} users</span>}
      >
        <InstitutionRoleManager
          initialRows={rows || []}
          initialControlledSubstanceCode={institutionSettings?.controlled_substance_code || ""}
          initialBypassPharmacyVerification={institutionSettings?.bypass_pharmacy_verification ?? false}
          departments={effectiveDepartmentCatalog}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Departments"
        description="Baseline departments are preloaded. Hospital managers can add custom departments as needed."
        defaultOpen
        summaryRight={
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {effectiveDepartmentCatalog.length} total
          </span>
        }
      >
        <InstitutionDepartmentsManager
          initialRows={effectiveDepartmentCatalog}
          tableReady={tableReady}
          tableError={departmentCatalogError?.message ?? null}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        id="safety"
        title="Safety Queue"
        description="Review and close adverse events."
        summaryRight={<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{mappedSafetyRows.length}</span>}
      >
        <InstitutionSafetyQueue
          initialRows={mappedSafetyRows}
          currentUserRole={currentProfile?.role || null}
        />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Audit Trail"
        description="Patient and operational admin actions."
        summaryRight={<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{mappedAuditRows.length}</span>}
      >
        <InstitutionAuditTrail initialRows={mappedAuditRows} />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="ICD-10 Catalog"
        description="Custom diagnosis entries by section."
        summaryRight={<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{(icdRows || []).length}</span>}
      >
        <InstitutionIcd10Manager initialRows={icdRows || []} />
      </CollapsiblePanel>

      <CollapsiblePanel
        title="Department Chat Groups"
        description="Create channels and manage staff access."
        summaryRight={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
      >
        <InstitutionChatGroupsManager
          initialGroups={chatGroups || []}
          initialMembers={chatGroupMembers || []}
          users={rows || []}
        />
      </CollapsiblePanel>
    </div>
  );
}
