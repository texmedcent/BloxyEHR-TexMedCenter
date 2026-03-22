"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  role: string;
};

type GroupRow = {
  id: string;
  name: string;
  department_key: string | null;
  is_active: boolean;
};

type MemberRow = {
  group_id: string;
  user_id: string;
  role_in_group: string;
};

export function InstitutionChatGroupsManager({
  initialGroups,
  initialMembers,
  users,
}: {
  initialGroups: GroupRow[];
  initialMembers: MemberRow[];
  users: UserRow[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [members, setMembers] = useState(initialMembers);
  const [newName, setNewName] = useState("");
  const [newDepartmentKey, setNewDepartmentKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroups[0]?.id || "");
  const [selectedUserId, setSelectedUserId] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const selectedGroupMembers = members.filter((m) => m.group_id === selectedGroupId);
  const selectedGroupMemberIds = new Set(selectedGroupMembers.map((m) => m.user_id));
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const eligibleUsers = users.filter((u) => !selectedGroupMemberIds.has(u.id) && u.role !== "patient");

  const createGroup = async () => {
    if (!newName.trim()) {
      setMessage("Group name is required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { data: userData } = await supabase.auth.getUser();
    const actor = userData.user;
    const { data, error } = await supabase
      .from("employee_chat_groups")
      .insert({
        name: newName.trim(),
        department_key: newDepartmentKey.trim() || null,
        is_active: true,
        created_by: actor?.id || null,
        created_by_name: actor?.email || "Manager",
      })
      .select("id, name, department_key, is_active")
      .single();

    if (error || !data) {
      setSaving(false);
      setMessage(`Failed to create group: ${error?.message || "Unknown error"}`);
      return;
    }

    if (actor?.id) {
      await supabase.from("employee_chat_group_members").insert({
        group_id: data.id,
        user_id: actor.id,
        role_in_group: "owner",
        joined_by: actor.id,
        joined_by_name: actor.email || "Manager",
      });
      setMembers((prev) => [
        ...prev,
        { group_id: data.id, user_id: actor.id, role_in_group: "owner" },
      ]);
    }

    setGroups((prev) => [data, ...prev]);
    setSelectedGroupId(data.id);
    setNewName("");
    setNewDepartmentKey("");
    setSaving(false);
    setMessage("Group created.");
  };

  const toggleArchive = async (groupId: string, nextActive: boolean) => {
    setSaving(true);
    setMessage(null);
    const payload = {
      is_active: nextActive,
      archived_at: nextActive ? null : new Date().toISOString(),
    };
    const { error } = await supabase.from("employee_chat_groups").update(payload).eq("id", groupId);
    setSaving(false);
    if (error) {
      setMessage(`Failed to update group: ${error.message}`);
      return;
    }
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, is_active: nextActive } : g)));
    setMessage(nextActive ? "Group re-activated." : "Group archived.");
  };

  const addMember = async () => {
    if (!selectedGroupId || !selectedUserId) return;
    setSaving(true);
    setMessage(null);
    const { data: userData } = await supabase.auth.getUser();
    const actor = userData.user;
    const { error } = await supabase.from("employee_chat_group_members").insert({
      group_id: selectedGroupId,
      user_id: selectedUserId,
      role_in_group: "member",
      joined_by: actor?.id || null,
      joined_by_name: actor?.email || "Manager",
    });
    setSaving(false);
    if (error) {
      setMessage(`Failed to add member: ${error.message}`);
      return;
    }
    setMembers((prev) => [...prev, { group_id: selectedGroupId, user_id: selectedUserId, role_in_group: "member" }]);
    setSelectedUserId("");
    setMessage("Member added.");
  };

  const removeMember = async (groupId: string, userId: string) => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("employee_chat_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      setMessage(`Failed to remove member: ${error.message}`);
      return;
    }
    setMembers((prev) => prev.filter((m) => !(m.group_id === groupId && m.user_id === userId)));
    setMessage("Member removed.");
  };

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-3 py-2 text-sm text-slate-700 dark:text-foreground">{message}</div>
      )}

      <div className="rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card p-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">Department Chat Groups</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
          Create channels by department and assign staff members to each group.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <div>
            <Label htmlFor="chat-group-name">Group Name</Label>
            <Input
              id="chat-group-name"
              className="mt-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Emergency Department"
            />
          </div>
          <div>
            <Label htmlFor="chat-group-dept">Department Key (optional)</Label>
            <Input
              id="chat-group-dept"
              className="mt-1"
              value={newDepartmentKey}
              onChange={(e) => setNewDepartmentKey(e.target.value)}
              placeholder="e.g. emergency"
            />
          </div>
          <div className="flex items-end">
            <Button disabled={saving} onClick={createGroup}>
              {saving ? "Saving..." : "Create Group"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card p-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-foreground">Groups</h4>
          <div className="mt-2 space-y-2">
            {groups.map((group) => (
              <button
                type="button"
                key={group.id}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  group.id === selectedGroupId
                    ? "border-primary dark:border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-slate-200 dark:border-border bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted"
                }`}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-foreground">{group.name}</span>
                  <span className={`text-[11px] uppercase ${group.is_active ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-muted-foreground"}`}>
                    {group.is_active ? "active" : "archived"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                  Department: {group.department_key || "none"}
                </p>
              </button>
            ))}
            {groups.length === 0 && <p className="text-xs text-slate-500 dark:text-muted-foreground">No groups created yet.</p>}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-foreground">
              Group Members{selectedGroup ? ` · ${selectedGroup.name}` : ""}
            </h4>
            {selectedGroup && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => toggleArchive(selectedGroup.id, !selectedGroup.is_active)}
              >
                {selectedGroup.is_active ? "Archive Group" : "Re-Activate Group"}
              </Button>
            )}
          </div>

          {selectedGroup ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1">
                  <Label htmlFor="chat-group-add-member">Add Member</Label>
                  <select
                    id="chat-group-add-member"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-1 h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">Select staff member</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.full_name || u.email || "User") + (u.department ? ` · ${u.department}` : "")}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" disabled={saving || !selectedUserId} onClick={addMember}>
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {selectedGroupMembers.map((m) => {
                  const user = users.find((u) => u.id === m.user_id);
                  return (
                    <div key={`${m.group_id}-${m.user_id}`} className="flex items-center justify-between rounded border border-slate-200 dark:border-border px-2 py-1.5">
                      <div className="text-sm">
                        <p className="font-medium text-foreground">{user?.full_name || user?.email || m.user_id}</p>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">
                          {(user?.department || "No department")} · {m.role_in_group}
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" disabled={saving} onClick={() => removeMember(m.group_id, m.user_id)}>
                        Remove
                      </Button>
                    </div>
                  );
                })}
                {selectedGroupMembers.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">No members in this group yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500 dark:text-muted-foreground">Select a group to manage members.</p>
          )}
        </div>
      </div>
    </div>
  );
}
