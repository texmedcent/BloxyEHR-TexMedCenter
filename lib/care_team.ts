import type { SupabaseClient } from "@supabase/supabase-js";

export type CareTeamAddedVia =
  | "encounter_assign"
  | "encounter_edit"
  | "documentation"
  | "order"
  | "disposition";

/**
 * Adds the current user to a patient's care team, or updates added_at if already present.
 * Call this after encounter edits, documentation, etc.
 */
export async function addProviderToCareTeam(
  supabase: SupabaseClient,
  patientId: string,
  addedVia: CareTeamAddedVia
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("patient_care_team").upsert(
    {
      patient_id: patientId,
      provider_id: user.id,
      added_at: new Date().toISOString(),
      added_via: addedVia,
    },
    {
      onConflict: "patient_id,provider_id",
      ignoreDuplicates: false,
    }
  );
}
