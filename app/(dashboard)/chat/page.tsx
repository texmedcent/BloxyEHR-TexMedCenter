import { createClient } from "@/lib/supabase/server";
import { EmployeeChatPanel } from "@/components/chat/EmployeeChatPanel";
import { STAFF_ROLES } from "@/lib/roles";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myMemberships } = user
    ? await supabase
        .from("employee_chat_group_members")
        .select("group_id, role_in_group")
        .eq("user_id", user.id)
    : { data: [] };

  const groupIds = (myMemberships || []).map((m) => m.group_id);
  const { data: groups } =
    groupIds.length > 0
      ? await supabase
          .from("employee_chat_groups")
          .select("id, name, department_key, is_active")
          .in("id", groupIds)
          .eq("is_active", true)
          .order("name", { ascending: true })
      : { data: [] };

  const roleByGroupId = new Map((myMemberships || []).map((m) => [m.group_id, m.role_in_group]));
  const groupsWithMembership = (groups || []).map((g) => ({
    ...g,
    role_in_group: roleByGroupId.get(g.id) || "member",
  }));

  const firstGroupId = groupsWithMembership[0]?.id || null;
  const { data: messages } =
    firstGroupId
      ? await supabase
          .from("employee_chat_messages")
          .select("id, sender_id, sender_name, sender_role, message, created_at, group_id")
          .eq("group_id", firstGroupId)
          .order("created_at", { ascending: true })
          .limit(200)
      : { data: [] };

  const { data: staff } = user
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", STAFF_ROLES)
        .neq("id", user.id)
        .order("full_name")
    : { data: [] };

  type DmThreadRow = { id: string; other_user_id: string; other_user_name: string | null; last_message_at: string };
  let dmThreads: { id: string; other_user_id: string; other_user_name: string; last_message_at: string }[] = [];
  let dmMessages: { id: string; sender_id: string; sender_name: string; sender_role: string | null; message: string; created_at: string; thread_id: string }[] = [];
  if (user) {
    const { data: threads } = await supabase.rpc("fetch_my_dm_threads");
    dmThreads = (threads || []).map((t: DmThreadRow) => ({
      id: t.id,
      other_user_id: t.other_user_id,
      other_user_name: t.other_user_name || "Unknown",
      last_message_at: t.last_message_at,
    }));

    const firstThreadId = dmThreads[0]?.id || null;
    if (firstThreadId) {
      const { data: msgs } = await supabase.rpc("fetch_dm_messages", { p_thread_id: firstThreadId });
      dmMessages = msgs || [];
    }
  }

  const firstThreadId = dmThreads[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Team Chat</h1>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Department groups and direct messages with hospital staff.
        </p>
        {groupsWithMembership.length === 0 && (
          <p className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-200">
            You are not a member of any department chat groups. You can still message colleagues directly.
          </p>
        )}
      </div>
      <EmployeeChatPanel
        initialGroups={groupsWithMembership}
        initialMessages={messages || []}
        initialGroupId={firstGroupId}
        initialStaff={staff || []}
        initialDmThreads={dmThreads}
        initialDmThreadId={firstThreadId}
        initialDmMessages={dmMessages || []}
      />
    </div>
  );
}
