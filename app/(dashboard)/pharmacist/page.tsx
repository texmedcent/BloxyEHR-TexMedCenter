import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PharmacistPanelView } from "@/components/pharmacist/PharmacistPanelView";
import { isPharmacist } from "@/lib/roles";

export default async function PharmacistPage() {
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

  if (!isPharmacist(profile?.role)) {
    redirect("/dashboard");
  }

  const { data: institutionSettings } = await supabase
    .from("institution_settings")
    .select("bypass_pharmacy_verification")
    .eq("id", 1)
    .maybeSingle();

  const bypass = institutionSettings?.bypass_pharmacy_verification ?? false;

  let orders: {
    id: string;
    details: unknown;
    ordered_at: string;
    ordered_by: string | null;
    patient_id: string;
    is_controlled_substance: boolean;
    high_risk_med: boolean;
    ordered_by_name: string;
    patient_first_name: string;
    patient_last_name: string;
    patient_mrn: string;
  }[] = [];

  if (!bypass) {
    const { data: rows, error } = await supabase.rpc("fetch_pending_pharmacy_verification_orders");
    if (!error && rows) {
      orders = rows.map((r: { id: string; details: unknown; ordered_at: string; ordered_by: string | null; patient_id: string; is_controlled_substance: boolean; high_risk_med: boolean; ordered_by_name: string; patient_first_name: string; patient_last_name: string; patient_mrn: string }) => ({
        id: r.id,
        details: r.details,
        ordered_at: r.ordered_at,
        ordered_by: r.ordered_by,
        patient_id: r.patient_id,
        is_controlled_substance: r.is_controlled_substance,
        high_risk_med: r.high_risk_med,
        ordered_by_name: r.ordered_by_name || "Staff",
        patient_first_name: r.patient_first_name || "",
        patient_last_name: r.patient_last_name || "",
        patient_mrn: r.patient_mrn || "",
      }));
    } else if (error?.message?.includes("schema cache") || error?.message?.includes("Could not find the function")) {
      const { data: orderRows } = await supabase
        .from("orders")
        .select("id, details, ordered_at, ordered_by, patient_id, is_controlled_substance, high_risk_med")
        .eq("type", "med")
        .or("is_controlled_substance.eq.true,high_risk_med.eq.true")
        .in("status", ["pending", "active", "held"])
        .is("pharmacy_verified_at", null)
        .order("ordered_at", { ascending: true })
        .limit(50);
      const list = orderRows || [];
      const patientIds = [...new Set(list.map((o) => o.patient_id).filter(Boolean))];
      const patientMap = new Map<string, { first_name: string; last_name: string; mrn: string }>();
      if (patientIds.length > 0) {
        const { data: patients } = await supabase.from("patients").select("id, first_name, last_name, mrn").in("id", patientIds);
        for (const p of patients ?? []) {
          patientMap.set(p.id, { first_name: p.first_name, last_name: p.last_name, mrn: p.mrn });
        }
      }
      orders = list.map((o) => ({
        id: o.id,
        details: o.details,
        ordered_at: o.ordered_at,
        ordered_by: o.ordered_by,
        patient_id: o.patient_id,
        is_controlled_substance: o.is_controlled_substance,
        high_risk_med: o.high_risk_med,
        ordered_by_name: "Staff",
        patient_first_name: patientMap.get(o.patient_id)?.first_name ?? "",
        patient_last_name: patientMap.get(o.patient_id)?.last_name ?? "",
        patient_mrn: patientMap.get(o.patient_id)?.mrn ?? "",
      }));
    }
  }

  return (
    <PharmacistPanelView
      initialOrders={orders}
      bypassOn={bypass}
    />
  );
}
