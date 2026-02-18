import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "@/components/schedule/ScheduleView";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const targetDate = date
    ? new Date(date)
    : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, slot_start, slot_end, type, status, patient_id")
    .gte("slot_start", startOfDay.toISOString())
    .lte("slot_start", endOfDay.toISOString())
    .order("slot_start");

  const patientIds = [
    ...new Set(
      (appointments || []).map((a) => a.patient_id).filter(Boolean)
    ),
  ];
  const { data: patientsData } =
    patientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, mrn, first_name, last_name")
          .in("id", patientIds)
      : { data: [] };
  const patientMap = new Map(
    (patientsData || []).map((p) => [p.id, p])
  );
  const { data: allPatients } = await supabase
    .from("patients")
    .select("id, mrn, first_name, last_name")
    .limit(200);

  return (
    <ScheduleView
      appointments={(appointments || []).map((a) => ({
        ...a,
        patient: a.patient_id ? patientMap.get(a.patient_id) : null,
      }))}
      patients={allPatients || []}
      currentDate={targetDate.toISOString().split("T")[0]}
      providerId={user?.id}
    />
  );
}
