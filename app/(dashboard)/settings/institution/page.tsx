import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstitutionRoleManager } from "@/components/settings/InstitutionRoleManager";
import { InstitutionAuditTrail } from "@/components/settings/InstitutionAuditTrail";
import { InstitutionSafetyQueue } from "@/components/settings/InstitutionSafetyQueue";
import { InstitutionChatGroupsManager } from "@/components/settings/InstitutionChatGroupsManager";
import { InstitutionIcd10Manager } from "@/components/settings/InstitutionIcd10Manager";
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
  const { data: icdRows } = await supabase
    .from("icd10_catalog")
    .select("code, label, category_key, is_active")
    .eq("is_active", true)
    .order("code", { ascending: true })
    .limit(120);

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

  return (
    <div className="space-y-8 max-w-5xl">
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

      <Card>
        <CardHeader>
          <CardTitle>User Roles & Medication Settings</CardTitle>
          <CardDescription>Assign roles and configure controlled substance workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstitutionRoleManager
            initialRows={rows || []}
            initialControlledSubstanceCode={institutionSettings?.controlled_substance_code || ""}
            initialBypassPharmacyVerification={institutionSettings?.bypass_pharmacy_verification ?? false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>Patient and operational admin actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstitutionAuditTrail initialRows={mappedAuditRows} />
        </CardContent>
      </Card>

      <Card id="safety">
        <CardHeader>
          <CardTitle>Safety Queue</CardTitle>
          <CardDescription>Review and close reported adverse events.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstitutionSafetyQueue
            initialRows={mappedSafetyRows}
            currentUserRole={currentProfile?.role || null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ICD-10 Catalog</CardTitle>
          <CardDescription>Custom diagnosis entries by section.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstitutionIcd10Manager initialRows={icdRows || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Department Chat Groups</CardTitle>
          <CardDescription>Create channels and manage staff access.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstitutionChatGroupsManager
            initialGroups={chatGroups || []}
            initialMembers={chatGroupMembers || []}
            users={rows || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
