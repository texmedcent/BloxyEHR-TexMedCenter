import type { SupabaseClient } from "@supabase/supabase-js";

/** Sets profiles.department_id and syncs legacy profiles.department text to the canonical name. */
export async function updateProfileDepartment(
  supabase: SupabaseClient,
  userId: string,
  departmentId: string | null
) {
  if (!departmentId) {
    return await supabase
      .from("profiles")
      .update({ department_id: null, department: null })
      .eq("id", userId);
  }

  const { data: row, error: fetchErr } = await supabase
    .from("institution_departments")
    .select("name")
    .eq("id", departmentId)
    .maybeSingle();

  if (fetchErr) return { data: null, error: fetchErr };
  if (!row) {
    return {
      data: null,
      error: { message: "Department not found", details: "", hint: "", code: "PGRST116", name: "" },
    };
  }

  return await supabase
    .from("profiles")
    .update({
      department_id: departmentId,
      department: row.name,
    })
    .eq("id", userId);
}

/** Sets up to 3 departments for a user and keeps profiles.department_id as primary. */
export async function updateProfileDepartments(
  supabase: SupabaseClient,
  userId: string,
  departmentIds: string[],
  primaryDepartmentId: string
) {
  const uniqueIds = Array.from(new Set(departmentIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {
      data: null,
      error: { message: "Select at least one department.", details: "", hint: "", code: "PGRST116", name: "" },
    };
  }
  if (uniqueIds.length > 3) {
    return {
      data: null,
      error: { message: "You can select up to 3 departments.", details: "", hint: "", code: "PGRST116", name: "" },
    };
  }
  if (!uniqueIds.includes(primaryDepartmentId)) {
    return {
      data: null,
      error: { message: "Primary department must be selected.", details: "", hint: "", code: "PGRST116", name: "" },
    };
  }

  const { data: rows, error: fetchErr } = await supabase
    .from("institution_departments")
    .select("id, name")
    .in("id", uniqueIds);
  if (fetchErr) return { data: null, error: fetchErr };

  const nameById = new Map((rows || []).map((row) => [row.id, row.name]));
  if (nameById.size !== uniqueIds.length) {
    return {
      data: null,
      error: { message: "One or more departments were not found.", details: "", hint: "", code: "PGRST116", name: "" },
    };
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from("profile_departments")
    .select("department_id")
    .eq("user_id", userId);
  if (existingErr) return { data: null, error: existingErr };

  const toRemove = (existingRows || [])
    .map((row) => row.department_id)
    .filter((departmentId) => !uniqueIds.includes(departmentId));
  if (toRemove.length > 0) {
    const { error: deleteErr } = await supabase
      .from("profile_departments")
      .delete()
      .eq("user_id", userId)
      .in("department_id", toRemove);
    if (deleteErr) return { data: null, error: deleteErr };
  }

  const upsertRows = uniqueIds.map((id) => ({
    user_id: userId,
    department_id: id,
    is_primary: id === primaryDepartmentId,
  }));
  const { error: upsertErr } = await supabase
    .from("profile_departments")
    .upsert(upsertRows, { onConflict: "user_id,department_id" });
  if (upsertErr) return { data: null, error: upsertErr };

  const { error: clearPrimaryErr } = await supabase
    .from("profile_departments")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .neq("department_id", primaryDepartmentId);
  if (clearPrimaryErr) return { data: null, error: clearPrimaryErr };

  const { error: setPrimaryErr } = await supabase
    .from("profile_departments")
    .update({ is_primary: true })
    .eq("user_id", userId)
    .eq("department_id", primaryDepartmentId);
  if (setPrimaryErr) return { data: null, error: setPrimaryErr };

  return await supabase
    .from("profiles")
    .update({
      department_id: primaryDepartmentId,
      department: nameById.get(primaryDepartmentId) ?? null,
    })
    .eq("id", userId);
}
