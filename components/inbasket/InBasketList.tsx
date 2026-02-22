"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface InBasketItem {
  id: string;
  type: string;
  priority: string;
  read_at: string | null;
  created_at: string;
  headline?: string;
  details?: string;
  patientName?: string;
  patientMrn?: string;
  relatedPatientId?: string | null;
  taskId?: string;
  taskStatus?: string;
  taskSlaViolation?: boolean;
  taskEscalated?: boolean;
}

interface InBasketListProps {
  items: InBasketItem[];
}

export function InBasketList({ items }: InBasketListProps) {
  const router = useRouter();
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDetails, setNewTaskDetails] = useState("");
  const [newTaskDueAt, setNewTaskDueAt] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [items]
  );

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("in_basket_items")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    router.refresh();
  };

  const clearItem = async (id: string) => {
    setClearingId(id);
    const supabase = createClient();
    if (id.startsWith("task-")) {
      const taskId = id.replace("task-", "");
      await supabase
        .from("in_basket_tasks")
        .update({ status: "cancelled" })
        .eq("id", taskId);
    } else {
      await supabase.from("in_basket_items").delete().eq("id", id);
    }
    setClearingId(null);
    router.refresh();
  };

  const clearAll = async () => {
    setClearingAll(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("in_basket_items").delete().eq("recipient_id", user.id);
      await supabase
        .from("in_basket_tasks")
        .update({ status: "cancelled" })
        .eq("owner_id", user.id)
        .in("status", ["open", "in_progress"]);
    }
    setClearingAll(false);
    router.refresh();
  };

  const completeTask = async (taskId: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : { data: null };
    await supabase
      .from("in_basket_tasks")
      .update({
        status: "completed",
        completion_reason: "Completed from In Basket",
        completed_by: user?.id || null,
        completed_by_name: profile?.full_name || user?.email || "Clinician",
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    router.refresh();
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    await supabase.from("in_basket_tasks").insert({
      owner_id: user.id,
      owner_name: profile?.full_name || user.email || "Clinician",
      created_by: user.id,
      created_by_name: profile?.full_name || user.email || "Clinician",
      title: newTaskTitle.trim(),
      details: newTaskDetails.trim() || null,
      due_at: newTaskDueAt ? new Date(newTaskDueAt).toISOString() : null,
      priority: newTaskPriority,
      status: "open",
    });
    setNewTaskTitle("");
    setNewTaskDetails("");
    setNewTaskDueAt("");
    setNewTaskPriority("normal");
    router.refresh();
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-foreground">
            <Inbox className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
            Tasks & Notifications
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={clearAll}
            disabled={clearingAll || sorted.length === 0}
          >
            {clearingAll ? "Clearing..." : "Clear All"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Create Task
          </p>
          <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_170px_150px_auto]">
            <input
              className="h-8 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-xs text-slate-900 dark:text-foreground"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
            />
            <input
              className="h-8 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-xs text-slate-900 dark:text-foreground"
              value={newTaskDetails}
              onChange={(e) => setNewTaskDetails(e.target.value)}
              placeholder="Task details"
            />
            <input
              className="h-8 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-xs text-slate-900 dark:text-foreground"
              type="datetime-local"
              value={newTaskDueAt}
              onChange={(e) => setNewTaskDueAt(e.target.value)}
            />
            <select
              className="h-8 rounded-md border border-slate-300 dark:border-input bg-white dark:bg-background px-2 text-xs text-slate-900 dark:text-foreground"
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <Button size="sm" className="h-8 text-xs" onClick={createTask}>
              Add Task
            </Button>
          </div>
        </div>
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-border bg-slate-50 dark:bg-muted/30 p-8 text-center">
            <Inbox className="mx-auto h-10 w-10 text-slate-400 dark:text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-foreground">No items in your In Basket</p>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Tasks and notifications will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-border">
            {sorted.map((item) => (
              <li
                key={item.id}
                className={`py-3 flex justify-between items-start gap-4 rounded-lg px-2 -mx-2 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors ${
                  !item.read_at ? "font-medium text-slate-900 dark:text-foreground" : "text-slate-600 dark:text-muted-foreground"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {item.headline || `${item.type} notification`}
                  </p>
                  {item.details && (
                    <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                      {item.details}
                    </p>
                  )}
                  {item.patientName && (
                    <p className="text-xs text-slate-500 dark:text-muted-foreground">
                      {item.patientName}
                      {item.patientMrn ? ` (MRN: ${item.patientMrn})` : ""}
                    </p>
                  )}
                  {item.taskStatus && (
                    <p className="text-xs text-slate-500 dark:text-muted-foreground">
                      Task status: {item.taskStatus.replaceAll("_", " ")}
                    </p>
                  )}
                  {(item.taskSlaViolation || item.taskEscalated) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                      {item.taskSlaViolation && (
                        <span className="rounded-md bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 text-red-700 dark:text-red-300 text-[11px]">
                          SLA overdue
                        </span>
                      )}
                      {item.taskEscalated && (
                        <span className="rounded-md bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-amber-700 dark:text-amber-300 text-[11px]">
                          Escalated
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.taskId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => completeTask(item.taskId as string)}
                    >
                      Complete Task
                    </Button>
                  )}
                  {item.relatedPatientId && (
                    <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                      <Link href={`/chart/${item.relatedPatientId}`}>Open Chart</Link>
                    </Button>
                  )}
                  <span className="text-sm text-slate-500 dark:text-muted-foreground">
                    {format(new Date(item.created_at), "MM/dd/yyyy HH:mm")}
                  </span>
                  {!item.read_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(item.id)}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearItem(item.id)}
                    title="Clear notification"
                    disabled={clearingId === item.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
