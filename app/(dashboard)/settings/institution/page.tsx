import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("controlled_substance_code")
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground">Institution</h1>
      <p className="text-sm text-slate-600 dark:text-muted-foreground">
        Manage role assignments for users in your hospital.
      </p>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">Audit Trail</h2>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Logs patient actions and operational admin actions (including department chat group management).
        </p>
        <InstitutionAuditTrail initialRows={mappedAuditRows} />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">Safety Queue</h2>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Review and close reported adverse events.
        </p>
        <InstitutionSafetyQueue
          initialRows={mappedSafetyRows}
          currentUserRole={currentProfile?.role || null}
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">ICD-10 Catalog</h2>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Add custom diagnosis entries by section. The system auto-generates a random ICD-style code.
        </p>
        <InstitutionIcd10Manager initialRows={icdRows || []} />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">Department Chat Groups</h2>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Create department channels and manage which staff can read/post in each chat group.
        </p>
        <InstitutionChatGroupsManager
          initialGroups={chatGroups || []}
          initialMembers={chatGroupMembers || []}
          users={rows || []}
        />
      </div>
      <InstitutionRoleManager
        initialRows={rows || []}
        initialControlledSubstanceCode={institutionSettings?.controlled_substance_code || ""}
      />
    </div>
  );
}
