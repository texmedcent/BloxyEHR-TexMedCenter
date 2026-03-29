"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Check, Trash2, CheckCircle, XCircle, Search, PlusCircle, MailOpen } from "lucide-react";
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
  loaId?: string;
  loaRequesterId?: string;
  loaRequesterName?: string;
  patientAuthUserId?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
}

interface InBasketListProps {
  items: InBasketItem[];
}

export function InBasketList({ items }: InBasketListProps) {
  const router = useRouter();
  const [clearingAll, setClearingAll] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [boxFilter, setBoxFilter] = useState<"all" | "unread" | "tasks" | "results" | "loa">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDetails, setNewTaskDetails] = useState("");
  const [newTaskDueAt, setNewTaskDueAt] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [items]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter((item) => {
      if (boxFilter === "unread" && item.read_at) return false;
      if (boxFilter === "tasks" && item.type !== "task") return false;
      if (boxFilter === "results" && item.type !== "result") return false;
      if (boxFilter === "loa" && item.type !== "loa_request") return false;
      if (!q) return true;
      const haystack = [
        item.headline ?? "",
        item.details ?? "",
        item.patientName ?? "",
        item.patientMrn ?? "",
        item.type ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sorted, boxFilter, searchQuery]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((i) => i.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    setReplyBody("");
    setReplyError(null);
  }, [selectedId]);

  const selectedItem = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? null,
    [filtered, selectedId]
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
    if (id.startsWith("loa-")) return; // LOA items are resolved via approve/deny, not clear
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

  const handleLoaReview = async (loaId: string, loaRequesterId: string, loaRequesterName: string | undefined, approved: boolean) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: reviewerProfile } = user
      ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      : { data: null };
    const status = approved ? "approved" : "denied";
    await supabase
      .from("time_off_requests")
      .update({
        status,
        reviewed_by_id: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", loaId);
    // Notify requester in their In Basket
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", loaRequesterId)
      .maybeSingle();
    await supabase.from("in_basket_tasks").insert({
      owner_id: loaRequesterId,
      owner_name: requesterProfile?.full_name ?? loaRequesterName ?? "Staff",
      title: approved ? "Leave of Absence Request Approved" : "Leave of Absence Request Denied",
      details: `Your LOA request was ${status} by ${reviewerProfile?.full_name ?? "a manager"}.`,
      created_by: user?.id ?? null,
      created_by_name: reviewerProfile?.full_name ?? "Manager",
      status: "open",
      priority: "normal",
    });
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

  const sendPatientReply = async (item: InBasketItem) => {
    if (!item.taskId || !item.patientAuthUserId || !item.relatedPatientId || !replyBody.trim()) return;
    setReplyBusy(true);
    setReplyError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setReplyBusy(false);
      setReplyError("You must be logged in to reply.");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const subject = (item.headline || "Patient Message").replace(/^Patient Message:\s*/i, "").trim() || "Portal message";
    const providerName = profile?.full_name || user.email || "Provider";

    const { error } = await supabase.from("in_basket_tasks").insert({
      owner_id: item.patientAuthUserId,
      owner_name: item.patientName || "Patient",
      patient_id: item.relatedPatientId,
      title: `Provider Reply: ${subject}`,
      details: `From: ${providerName}\n\n${replyBody.trim()}`,
      priority: "normal",
      status: "open",
      created_by: user.id,
      created_by_name: providerName,
    });
    if (error) {
      setReplyBusy(false);
      setReplyError(error.message || "Unable to send reply.");
      return;
    }

    await supabase
      .from("in_basket_tasks")
      .update({
        status: "completed",
        completion_reason: "Replied to patient from In Basket",
        completed_by: user.id,
        completed_by_name: providerName,
        completed_at: new Date().toISOString(),
      })
      .eq("id", item.taskId);

    setReplyBody("");
    setReplyBusy(false);
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
    setShowComposer(false);
    router.refresh();
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-foreground">
            <Inbox className="h-5 w-5 text-[#1a4d8c] dark:text-primary" />
            In Basket
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setShowComposer((v) => !v)}
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              {showComposer ? "Hide task form" : "New task"}
            </Button>
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
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showComposer ? (
          <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50 p-3">
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
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search In Basket"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm"
            />
          </div>
          {(["all", "unread", "tasks", "results", "loa"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={boxFilter === f ? "default" : "outline"}
              className="h-8 capitalize"
              onClick={() => setBoxFilter(f)}
            >
              {f === "loa" ? "LOA" : f}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-border bg-slate-50 dark:bg-muted/30 p-8 text-center">
            <Inbox className="mx-auto h-10 w-10 text-slate-400 dark:text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-foreground">No items match this view</p>
            <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">Try changing filters or search.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-lg border border-slate-200 dark:border-border overflow-hidden">
              <ul className="max-h-[640px] overflow-y-auto divide-y divide-slate-200 dark:divide-border">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        selectedId === item.id
                          ? "bg-primary/10"
                          : "hover:bg-slate-50 dark:hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!item.read_at ? "font-semibold" : "font-medium"}`}>
                          {item.headline || `${item.type} notification`}
                        </p>
                        {!item.read_at ? <span className="h-2 w-2 rounded-full bg-primary shrink-0" /> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {item.details || "No preview"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {format(new Date(item.created_at), "MM/dd/yyyy HH:mm")}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-border p-4 min-h-[420px]">
              {selectedItem ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-foreground">
                        {selectedItem.headline || `${selectedItem.type} notification`}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedItem.created_at), "EEEE, MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-xs uppercase">
                      {selectedItem.type.replaceAll("_", " ")}
                    </span>
                  </div>

                  {selectedItem.details ? (
                    <p className="text-sm text-slate-700 dark:text-foreground whitespace-pre-wrap">
                      {selectedItem.details}
                    </p>
                  ) : null}

                  {selectedItem.patientName ? (
                    <p className="text-sm text-muted-foreground">
                      Patient: {selectedItem.patientName}
                      {selectedItem.patientMrn ? ` (MRN: ${selectedItem.patientMrn})` : ""}
                    </p>
                  ) : null}

                  {selectedItem.taskStatus ? (
                    <p className="text-sm text-muted-foreground">
                      Task status: {selectedItem.taskStatus.replaceAll("_", " ")}
                    </p>
                  ) : null}

                  {(selectedItem.taskSlaViolation || selectedItem.taskEscalated) ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.taskSlaViolation ? (
                        <span className="rounded-md bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 text-red-700 dark:text-red-300 text-[11px]">
                          SLA overdue
                        </span>
                      ) : null}
                      {selectedItem.taskEscalated ? (
                        <span className="rounded-md bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 text-amber-700 dark:text-amber-300 text-[11px]">
                          Escalated
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedItem.type === "task" &&
                  (selectedItem.headline || "").toLowerCase().startsWith("patient message:") ? (
                    <div className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/60 dark:bg-muted/40 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reply to patient</p>
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        className="mt-2 min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Write your response to the patient..."
                      />
                      {replyError ? <p className="mt-2 text-xs text-destructive">{replyError}</p> : null}
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => sendPatientReply(selectedItem)}
                          disabled={replyBusy || !replyBody.trim() || !selectedItem.patientAuthUserId}
                        >
                          {replyBusy ? "Sending..." : "Send Reply"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-border">
                    {selectedItem.type === "loa_request" && selectedItem.loaId && selectedItem.loaRequesterId ? (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            handleLoaReview(
                              selectedItem.loaId!,
                              selectedItem.loaRequesterId!,
                              selectedItem.loaRequesterName,
                              true
                            )
                          }
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            handleLoaReview(
                              selectedItem.loaId!,
                              selectedItem.loaRequesterId!,
                              selectedItem.loaRequesterName,
                              false
                            )
                          }
                        >
                          <XCircle className="h-3.5 w-3.5" /> Deny
                        </Button>
                      </>
                    ) : null}

                    {selectedItem.taskId && selectedItem.type !== "loa_request" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => completeTask(selectedItem.taskId as string)}
                        disabled={selectedItem.taskStatus === "completed"}
                      >
                        Complete Task
                      </Button>
                    ) : null}

                    {selectedItem.relatedPatientId ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/chart/${selectedItem.relatedPatientId}`}>Open Chart</Link>
                      </Button>
                    ) : null}

                    {!selectedItem.read_at && selectedItem.type !== "loa_request" ? (
                      <Button variant="ghost" size="sm" onClick={() => markAsRead(selectedItem.id)}>
                        <Check className="h-4 w-4 mr-1" />
                        Mark read
                      </Button>
                    ) : null}

                    {selectedItem.type !== "loa_request" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearItem(selectedItem.id)}
                        disabled={clearingId === selectedItem.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Hide
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center text-muted-foreground">
                  <MailOpen className="h-10 w-10 mb-2" />
                  <p className="text-sm font-medium">Select a message</p>
                  <p className="text-xs">Choose an item from the left to read details and actions.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
