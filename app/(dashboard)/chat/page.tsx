import { createClient } from "@/lib/supabase/server";
import { EmployeeChatPanel } from "@/components/chat/EmployeeChatPanel";

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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card p-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Employee Chat</h1>
        <p className="text-sm text-slate-600 dark:text-muted-foreground">
          Secure internal messaging for on-duty staff.
        </p>
        {groupsWithMembership.length === 0 && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            You are not a member of any active department chat groups. Ask a Hospital Manager to assign you.
          </p>
        )}
      </div>
      <EmployeeChatPanel
        initialGroups={groupsWithMembership}
        initialMessages={messages || []}
        initialGroupId={firstGroupId}
      />
    </div>
  );
}
