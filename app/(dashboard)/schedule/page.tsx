import { createClient } from "@/lib/supabase/server";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { format, parseISO } from "date-fns";
import { CLINICAL_PROVIDER_ROLES } from "@/lib/roles";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; provider?: string }>;
}) {
  const { date, provider } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentDate = date || format(new Date(), "yyyy-MM-dd");
  const startOfDay = parseISO(`${currentDate}T00:00:00`);
  const endOfDay = parseISO(`${currentDate}T23:59:59.999`);

  const { data: providers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", CLINICAL_PROVIDER_ROLES)
    .order("full_name");

  let appointmentQuery = supabase
    .from("appointments")
    .select("id, slot_start, slot_end, type, status, patient_id, provider_id")
    .gte("slot_start", startOfDay.toISOString())
    .lte("slot_start", endOfDay.toISOString())
    .order("slot_start");

  if (provider && provider !== "all") {
    appointmentQuery = appointmentQuery.eq("provider_id", provider);
  }

  const { data: appointments } = await appointmentQuery;

  const providerIds = [...new Set((appointments || []).map((a) => a.provider_id).filter(Boolean))];
  const { data: providerProfiles } =
    providerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", providerIds)
      : { data: [] };
  const providerMap = new Map((providerProfiles || []).map((p) => [p.id, p]));

  const patientIds = [...new Set((appointments || []).map((a) => a.patient_id).filter(Boolean))];
  const { data: patientsData } =
    patientIds.length > 0
      ? await supabase
          .from("patients")
          .select("id, mrn, first_name, last_name")
          .in("id", patientIds)
      : { data: [] };
  const patientMap = new Map((patientsData || []).map((p) => [p.id, p]));

  const { data: allPatients } = await supabase
    .from("patients")
    .select("id, mrn, first_name, last_name")
    .limit(200);

  return (
    <ScheduleView
      appointments={(appointments || []).map((a) => ({
        ...a,
        patient: a.patient_id ? patientMap.get(a.patient_id) : null,
        provider_name: a.provider_id ? providerMap.get(a.provider_id)?.full_name : null,
      }))}
      patients={allPatients || []}
      providers={providers || []}
      currentDate={currentDate}
      selectedProviderId={provider && provider !== "all" ? provider : null}
      providerId={user?.id}
    />
  );
}
