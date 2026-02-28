"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, ClipboardList } from "lucide-react";
import { format } from "date-fns";

interface PersonalTask {
  id: string;
  title: string;
  details: string | null;
  due_at: string | null;
  priority: string;
  status: string;
}

interface DepartmentTask {
  id: string;
  department: string;
  title: string;
  details: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  assignee_id: string | null;
}

interface StaffTasksSectionProps {
  personalTasks: PersonalTask[];
  departmentTasks: DepartmentTask[];
  currentUserId: string;
  currentUserDepartment: string | null;
  isManager: boolean;
}

export function StaffTasksSection({
  personalTasks,
  departmentTasks,
  currentUserId,
  currentUserDepartment,
  isManager,
}: StaffTasksSectionProps) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newDeptTitle, setNewDeptTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "department">("personal");

  const openPersonal = personalTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const openDepartment = departmentTasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      (t.department === currentUserDepartment || t.assignee_id === currentUserId)
  );

  const markPersonalComplete = async (id: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
      : { data: null };

    await supabase
      .from("in_basket_tasks")
      .update({
        status: "completed",
        completed_by: user?.id,
        completed_by_name: profile?.full_name,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    router.refresh();
  };

  const markDepartmentComplete = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("department_tasks")
      .update({ status: "completed" })
      .eq("id", id);
    router.refresh();
  };

  const createPersonalTask = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
      : { data: null };

    await supabase.from("in_basket_tasks").insert({
      owner_id: user!.id,
      owner_name: profile?.full_name,
      title: newTitle.trim(),
      details: newDetails.trim() || null,
      created_by: user?.id,
      created_by_name: profile?.full_name,
    });
    setNewTitle("");
    setNewDetails("");
    setSaving(false);
    router.refresh();
  };

  const createDepartmentTask = async () => {
    if (!newDeptTitle.trim() || !currentUserDepartment) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("department_tasks").insert({
      department: currentUserDepartment,
      title: newDeptTitle.trim(),
      created_by_id: user?.id,
    });
    setNewDeptTitle("");
    setSaving(false);
    router.refresh();
  };

  const isOverdue = (dueAt: string | null) =>
    dueAt && new Date(dueAt) < new Date();

  const priorityBadge = (p: string) => {
    if (p === "critical") return <Badge variant="destructive">Critical</Badge>;
    if (p === "high") return <Badge variant="secondary">High</Badge>;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Tasks & Reminders
        </CardTitle>
        <CardDescription>Personal and department-wide tasks.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 border-b border-border pb-2">
          <Button
            variant={activeTab === "personal" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("personal")}
          >
            My Tasks
          </Button>
          <Button
            variant={activeTab === "department" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("department")}
          >
            Department Tasks
          </Button>
        </div>

        {activeTab === "personal" && (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="New task title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={createPersonalTask}
                disabled={saving || !newTitle.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {openPersonal.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open tasks.</p>
              ) : (
                openPersonal.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.title}</span>
                        {priorityBadge(t.priority)}
                        {isOverdue(t.due_at) && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      {t.details && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.details}</p>
                      )}
                      {t.due_at && (
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(t.due_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => markPersonalComplete(t.id)}
                    >
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "department" && (
          <>
            {isManager && currentUserDepartment && (
              <div className="flex gap-2">
                <Input
                  placeholder="New department task"
                  value={newDeptTitle}
                  onChange={(e) => setNewDeptTitle(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={createDepartmentTask}
                  disabled={saving || !newDeptTitle.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {openDepartment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No department tasks.</p>
              ) : (
                openDepartment.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{t.title}</span>
                        {priorityBadge(t.priority)}
                        {isOverdue(t.due_at) && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      {t.details && (
                        <p className="text-xs text-muted-foreground mt-0.5">{t.details}</p>
                      )}
                      {t.due_at && (
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(t.due_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    {(t.assignee_id === currentUserId || isManager) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => markDepartmentComplete(t.id)}
                      >
                        <CheckSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
