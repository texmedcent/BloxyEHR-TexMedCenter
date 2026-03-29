import { createClient } from "@/lib/supabase/server";
import { Inbox } from "lucide-react";
import { InBasketList } from "@/components/inbasket/InBasketList";
import { formatOrderDetails } from "@/lib/orders";
import { isHospitalManager } from "@/lib/roles";

export default async function InBasketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isManager = isHospitalManager(profile?.role);

  // Pending LOA requests for managers to approve/deny
  let loaItems: Array<{
    id: string;
    type: string;
    priority: string;
    read_at: null;
    created_at: string;
    headline: string;
    details: string;
    loaId?: string;
    loaRequesterId?: string;
    loaRequesterName?: string;
  }> = [];
  if (isManager && user) {
    const { data: pendingLoas } = await supabase
      .from("time_off_requests")
      .select("id, user_id, start_date, end_date, type, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (pendingLoas?.length) {
      const reqIds = [...new Set(pendingLoas.map((r) => r.user_id))];
      const { data: reqProfiles } = await supabase.from("profiles").select("id, full_name").in("id", reqIds);
      const nameMap = new Map((reqProfiles || []).map((p) => [p.id, p.full_name]));
      const TYPE_LABELS: Record<string, string> = { pto: "PTO", sick: "Sick", other: "Other" };
      loaItems = pendingLoas.map((r) => {
        const typeLabel = TYPE_LABELS[r.type] ?? r.type;
        const start = new Date(r.start_date).toLocaleDateString();
        const end = new Date(r.end_date).toLocaleDateString();
        return {
          id: `loa-${r.id}`,
          type: "loa_request",
          priority: "normal",
          read_at: null,
          created_at: r.created_at,
          headline: `LOA Request: ${nameMap.get(r.user_id) ?? "Staff"}`,
          details: `${typeLabel} · ${start} – ${end}`,
          loaId: r.id,
          loaRequesterId: r.user_id,
          loaRequesterName: nameMap.get(r.user_id) ?? undefined,
        };
      });
    }
  }

  const rawItems = user
    ? (
        await supabase
          .from("in_basket_items")
          .select("id, type, priority, read_at, created_at, related_entity_id")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];

  const resultIds = rawItems
    .filter((i) => i.type === "result" && i.related_entity_id)
    .map((i) => i.related_entity_id as string);

  const { data: relatedResults } =
    resultIds.length > 0
      ? await supabase
          .from("results")
          .select("id, type, status, patient_id, order_id, reported_at")
          .in("id", resultIds)
      : { data: [] };

  const patientIds = [
    ...new Set((relatedResults || []).map((r) => r.patient_id).filter(Boolean)),
  ] as string[];
  const { data: patients } =
    patientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, first_name, last_name, mrn")
          .in("id", patientIds)
      : { data: [] };

  const orderIds = [
    ...new Set((relatedResults || []).map((r) => r.order_id).filter(Boolean)),
  ] as string[];
  const { data: orders } =
    orderIds.length > 0
      ? await supabase
          .from("orders")
          .select("id, type, details")
          .in("id", orderIds)
      : { data: [] };

  const patientMap = new Map((patients || []).map((p) => [p.id, p]));
  const resultMap = new Map((relatedResults || []).map((r) => [r.id, r]));
  const orderMap = new Map((orders || []).map((o) => [o.id, o]));

  const items = rawItems.map((item) => {
    if (item.type !== "result" || !item.related_entity_id) {
      return {
        ...item,
        headline: `${item.type} notification`,
        details: `Priority: ${item.priority}`,
      };
    }

    const result = resultMap.get(item.related_entity_id);
    if (!result) {
      return {
        ...item,
        headline: "Result notification",
        details: "Result details unavailable",
      };
    }

    const patient = result.patient_id ? patientMap.get(result.patient_id) : null;
    const order = result.order_id ? orderMap.get(result.order_id) : null;
    const orderTypeLabel = order?.type ? order.type.toUpperCase() : "ORDER";
    const details = order ? formatOrderDetails(order.type, order.details) : "No order details";

    return {
      ...item,
      headline: `${result.status.toUpperCase()} ${result.type.toUpperCase()} result returned`,
      details: `Ordered: ${orderTypeLabel} · ${details}`,
      patientName: patient ? `${patient.last_name}, ${patient.first_name}` : "Unknown patient",
      patientMrn: patient?.mrn || "",
      relatedPatientId: result.patient_id || null,
    };
  });

  const taskRows = user
    ? (
        await supabase
          .from("in_basket_tasks")
          .select(
            "id, title, details, due_at, priority, status, patient_id, created_at, completed_at, sla_violation, escalation_triggered_at, created_by, created_by_name, owner_id, owner_name"
          )
          .eq("owner_id", user.id)
          .in("status", ["open", "in_progress", "completed"])
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(80)
      ).data ?? []
    : [];
  const taskPatientIds = [
    ...new Set(taskRows.map((row) => row.patient_id).filter(Boolean)),
  ] as string[];
  const { data: taskPatients } =
    taskPatientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, first_name, last_name, mrn, auth_user_id")
          .in("id", taskPatientIds)
      : { data: [] };
  const taskPatientMap = new Map((taskPatients || []).map((row) => [row.id, row]));

  const taskItems = taskRows.map((task) => {
    const patient = task.patient_id ? taskPatientMap.get(task.patient_id) : null;
    return {
      id: `task-${task.id}`,
      type: "task",
      priority: task.priority,
      read_at: task.status === "completed" ? task.completed_at || task.created_at : null,
      created_at: task.created_at,
      headline: task.title,
      details: `${task.details || ""}${task.due_at ? ` · Due ${new Date(task.due_at).toLocaleString()}` : ""}`.trim(),
      patientName: patient ? `${patient.last_name}, ${patient.first_name}` : undefined,
      patientMrn: patient?.mrn || "",
      relatedPatientId: task.patient_id || null,
      patientAuthUserId: patient?.auth_user_id || null,
      taskId: task.id,
      taskStatus: task.status,
      taskSlaViolation: Boolean(task.sla_violation),
      taskEscalated: Boolean(task.escalation_triggered_at),
      createdByUserId: task.created_by || null,
      createdByName: task.created_by_name || null,
    };
  });

  const allItems = [...loaItems, ...taskItems, ...items];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Inbox className="h-6 w-6 text-[#1a4d8c] dark:text-primary shrink-0" />
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground">In Basket</h1>
      </div>
      <InBasketList items={allItems} />
    </div>
  );
}
