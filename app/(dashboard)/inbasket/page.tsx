import { createClient } from "@/lib/supabase/server";
import { InBasketList } from "@/components/inbasket/InBasketList";
import { formatOrderDetails } from "@/lib/orders";

export default async function InBasketPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
          .select("id, title, details, due_at, priority, status, patient_id, created_at, sla_violation, escalation_triggered_at")
          .eq("owner_id", user.id)
          .in("status", ["open", "in_progress"])
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
          .select("id, first_name, last_name, mrn")
          .in("id", taskPatientIds)
      : { data: [] };
  const taskPatientMap = new Map((taskPatients || []).map((row) => [row.id, row]));

  const taskItems = taskRows.map((task) => {
    const patient = task.patient_id ? taskPatientMap.get(task.patient_id) : null;
    return {
      id: `task-${task.id}`,
      type: "task",
      priority: task.priority,
      read_at: null,
      created_at: task.created_at,
      headline: task.title,
      details: `${task.details || ""}${task.due_at ? ` · Due ${new Date(task.due_at).toLocaleString()}` : ""}`.trim(),
      patientName: patient ? `${patient.last_name}, ${patient.first_name}` : undefined,
      patientMrn: patient?.mrn || "",
      relatedPatientId: task.patient_id || null,
      taskId: task.id,
      taskStatus: task.status,
      taskSlaViolation: Boolean(task.sla_violation),
      taskEscalated: Boolean(task.escalation_triggered_at),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">In Basket</h1>
      <InBasketList items={[...taskItems, ...items]} />
    </div>
  );
}
