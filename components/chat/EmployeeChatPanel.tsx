"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  Video,
  Phone,
  MoreHorizontal,
  Paperclip,
  Smile,
  Plus,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { playDmNotificationSound } from "@/lib/notification-sound";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string | null;
  message: string;
  created_at: string;
  group_id: string;
}

interface DmThread {
  id: string;
  other_user_id: string;
  other_user_name: string;
  last_message_at: string;
}

interface DmMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string | null;
  message: string;
  created_at: string;
  thread_id: string;
}

interface StaffMember {
  id: string;
  full_name: string | null;
  role: string | null;
}

interface EmployeeChatPanelProps {
  initialGroups: ChatGroup[];
  initialMessages: ChatMessage[];
  initialGroupId: string | null;
  initialStaff?: StaffMember[];
  initialDmThreads?: DmThread[];
  initialDmThreadId?: string | null;
  initialDmMessages?: DmMessage[];
}

interface ChatGroup {
  id: string;
  name: string;
  department_key: string | null;
  role_in_group: string;
}

interface CurrentUserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
}

interface ToastMessage {
  id: number;
  message: string;
}

const POLL_MS = 5000;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

export function EmployeeChatPanel({
  initialGroups,
  initialMessages,
  initialGroupId,
  initialStaff = [],
  initialDmThreads = [],
  initialDmThreadId = null,
  initialDmMessages = [],
}: EmployeeChatPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [groups] = useState<ChatGroup[]>(initialGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [staff] = useState<StaffMember[]>(initialStaff);
  const [dmThreads, setDmThreads] = useState<DmThread[]>(initialDmThreads);
  const [selectedDmThreadId, setSelectedDmThreadId] = useState<string | null>(initialDmThreadId);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>(initialDmMessages);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const lastDmMessageIdRef = useRef<string | null>(null);

  const isDmMode = selectedDmThreadId !== null;
  const selectedDmThread = dmThreads.find((t) => t.id === selectedDmThreadId) || null;

  const pushToast = useCallback((message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const fetchMessages = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setMessages([]);
      setChatError(null);
      return;
    }
    setRefreshing(true);
    const { data, error } = await supabase
      .from("employee_chat_messages")
      .select("id, sender_id, sender_name, sender_role, message, created_at, group_id")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      setChatError(`Unable to load messages: ${error.message}`);
      pushToast(`Unable to load messages: ${error.message}`);
      setRefreshing(false);
      return;
    }
    setChatError(null);
    setMessages(data || []);
    setRefreshing(false);
  }, [pushToast, supabase]);

  const fetchDmMessages = useCallback(async (threadId: string | null) => {
    if (!threadId) {
      setDmMessages([]);
      setChatError(null);
      lastDmMessageIdRef.current = null;
      return;
    }
    setRefreshing(true);
    const { data, error } = await supabase.rpc("fetch_dm_messages", { p_thread_id: threadId });
    if (error) {
      setChatError(`Unable to load messages: ${error.message}`);
      pushToast(`Unable to load messages: ${error.message}`);
      setRefreshing(false);
      return;
    }
    setChatError(null);
    const messages = data || [];

    if (currentUser && messages.length > 0) {
      const lastMsg = messages[messages.length - 1] as { id: string; sender_id: string };
      const prevId = lastDmMessageIdRef.current;
      if (lastMsg.sender_id !== currentUser.id && prevId !== null && lastMsg.id !== prevId) {
        playDmNotificationSound();
      }
      lastDmMessageIdRef.current = lastMsg.id;
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1] as { id: string };
      lastDmMessageIdRef.current = lastMsg.id;
    }

    setDmMessages(messages);
    setRefreshing(false);
  }, [pushToast, supabase, currentUser]);

  const fetchDmThreads = useCallback(async () => {
    if (!currentUser) return;
    const { data: threads, error } = await supabase.rpc("fetch_my_dm_threads");
    if (error) return;
    setDmThreads(
      (threads || []).map((t: { id: string; other_user_id: string; other_user_name: string | null; last_message_at: string }) => ({
        id: t.id,
        other_user_id: t.other_user_id,
        other_user_name: t.other_user_name || "Unknown",
        last_message_at: t.last_message_at,
      }))
    );
  }, [currentUser, supabase]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();
      if (!profile) {
        pushToast("Could not load profile details. Messaging may be limited.");
      }
      setCurrentUser(
        profile || {
          id: user.id,
          full_name: user.email || "Unknown User",
          role: "staff",
        }
      );
    };

    loadCurrentUser();
    const interval = setInterval(() => {
      if (selectedGroupId) void fetchMessages(selectedGroupId);
      if (selectedDmThreadId) void fetchDmMessages(selectedDmThreadId);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMessages, fetchDmMessages, pushToast, selectedGroupId, selectedDmThreadId, supabase]);

  useEffect(() => {
    if (selectedGroupId) {
      setSelectedDmThreadId(null);
      void fetchMessages(selectedGroupId);
    }
  }, [fetchMessages, selectedGroupId]);

  useEffect(() => {
    if (selectedDmThreadId) {
      setSelectedGroupId(null);
      lastDmMessageIdRef.current = null;
      void fetchDmMessages(selectedDmThreadId);
    }
  }, [fetchDmMessages, selectedDmThreadId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, dmMessages.length]);

  const sendMessage = async () => {
    if (!currentUser || !messageText.trim() || sending) return;
    if (selectedGroupId) {
      setSending(true);
      const { error } = await supabase.from("employee_chat_messages").insert({
        sender_id: currentUser.id,
        sender_name: currentUser.full_name || "Staff User",
        sender_role: currentUser.role || "staff",
        message: messageText.trim(),
        group_id: selectedGroupId,
      });
      if (error) {
        setChatError(`Unable to send message: ${error.message}`);
        pushToast(`Unable to send message: ${error.message}`);
        setSending(false);
        return;
      }
      setChatError(null);
      setMessageText("");
      await fetchMessages(selectedGroupId);
      setSending(false);
    } else if (selectedDmThreadId) {
      setSending(true);
      const { error } = await supabase.rpc("send_dm_message", {
        p_thread_id: selectedDmThreadId,
        p_message: messageText.trim(),
      });
      if (error) {
        setChatError(`Unable to send message: ${error.message}`);
        pushToast(`Unable to send message: ${error.message}`);
        setSending(false);
        return;
      }
      setChatError(null);
      setMessageText("");
      await fetchDmMessages(selectedDmThreadId);
      await fetchDmThreads();
      setSending(false);
    }
  };

  const startOrOpenDm = async (otherUserId: string) => {
    if (!currentUser) return;
    const { data: threadId, error } = await supabase.rpc("get_or_create_dm_thread", {
      p_other_user_id: otherUserId,
    });
    if (error) {
      pushToast(`Unable to start conversation: ${error.message}`);
      return;
    }
    if (!threadId) {
      pushToast("Could not create conversation.");
      return;
    }
    setShowDmPicker(false);
    setSelectedGroupId(null);
    setSelectedDmThreadId(threadId);
    await fetchDmThreads();
    void fetchDmMessages(threadId);
  };

  const onSend = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;
  const displayMessages = isDmMode ? dmMessages : messages;
  const canSend = (selectedGroupId || selectedDmThreadId) && messageText.trim() && currentUser && !sending;

  return (
    <Card className="relative h-[calc(100vh-11rem)] overflow-hidden border-slate-200 dark:border-border bg-[#f3f2f1] dark:bg-card shadow-sm">
      {toasts.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded border border-rose-200 dark:border-rose-800 bg-white dark:bg-card px-3 py-2 text-xs text-slate-700 dark:text-foreground shadow"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
      <CardHeader className="border-b border-slate-200 dark:border-border bg-white dark:bg-card py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-foreground">
              <MessageCircle className="h-4.5 w-4.5 text-[#464eb8] dark:text-primary" />
              {selectedDmThread ? selectedDmThread.other_user_name : selectedGroup ? selectedGroup.name : "Team Chat"}
            </CardTitle>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
              <Badge variant="outline" className="h-5 rounded-sm bg-slate-50 dark:bg-muted px-1.5 text-[10px]">
                {displayMessages.length} messages
              </Badge>
              <Badge variant="outline" className="h-5 rounded-sm bg-slate-50 dark:bg-muted px-1.5 text-[10px]">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Internal
              </Badge>
              {selectedGroup?.department_key && (
                <Badge variant="outline" className="h-5 rounded-sm bg-slate-50 dark:bg-muted px-1.5 text-[10px] uppercase">
                  {selectedGroup.department_key}
                </Badge>
              )}
              {selectedDmThread && (
                <Badge variant="outline" className="h-5 rounded-sm bg-slate-50 dark:bg-muted px-1.5 text-[10px]">
                  1:1
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-slate-500 dark:text-muted-foreground shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-1 h-8 text-xs"
              onClick={() => {
                if (selectedGroupId) void fetchMessages(selectedGroupId);
                if (selectedDmThreadId) void fetchDmMessages(selectedDmThreadId);
              }}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
        <div className="mt-2 md:hidden flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Channel
            </label>
            <select
              value={selectedGroupId ? `g:${selectedGroupId}` : selectedDmThreadId ? `d:${selectedDmThreadId}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("g:")) {
                  setSelectedDmThreadId(null);
                  setSelectedGroupId(v.slice(2) || null);
                } else if (v.startsWith("d:")) {
                  setSelectedGroupId(null);
                  setSelectedDmThreadId(v.slice(2) || null);
                } else {
                  setSelectedGroupId(null);
                  setSelectedDmThreadId(null);
                }
              }}
              className="h-9 w-full rounded border border-slate-300 dark:border-input bg-white dark:bg-background px-3 text-sm"
            >
              <option value="">Select channel</option>
              <optgroup label="Department Groups">
                {groups.map((group) => (
                  <option key={group.id} value={`g:${group.id}`}>{group.name}</option>
                ))}
              </optgroup>
              <optgroup label="Direct Messages">
                {dmThreads.map((t) => (
                  <option key={t.id} value={`d:${t.id}`}>{t.other_user_name}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
        {chatError && (
          <div className="mt-2 rounded border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2 py-1.5 text-xs text-rose-700 dark:text-rose-300">
            {chatError}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex h-full p-0">
        <div className="hidden w-72 shrink-0 border-r border-slate-200 dark:border-border bg-white dark:bg-card md:block overflow-y-auto">
          <div className="border-b border-slate-200 dark:border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Department Groups
          </div>
          <div className="space-y-1 p-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setSelectedDmThreadId(null);
                  setSelectedGroupId(group.id);
                }}
                className={`w-full rounded px-2 py-2 text-left text-sm ${
                  group.id === selectedGroupId
                    ? "bg-[#ececff] dark:bg-primary/20 text-[#343897] dark:text-primary"
                    : "text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted"
                }`}
              >
                <p className="font-medium">{group.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
                  {group.department_key || "general"} · {group.role_in_group}
                </p>
              </button>
            ))}
            {groups.length === 0 && (
              <p className="rounded border border-dashed border-slate-300 dark:border-input px-2 py-3 text-xs text-slate-500 dark:text-muted-foreground">
                You are not assigned to any chat groups yet.
              </p>
            )}
          </div>
          <div className="border-t border-slate-200 dark:border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Direct Messages
          </div>
          <div className="p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 mb-2"
              onClick={() => setShowDmPicker(true)}
            >
              <UserPlus className="h-4 w-4" />
              New message
            </Button>
            <div className="space-y-1">
              {dmThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setSelectedGroupId(null);
                    setSelectedDmThreadId(thread.id);
                  }}
                  className={`w-full rounded px-2 py-2 text-left text-sm flex items-center gap-2 ${
                    thread.id === selectedDmThreadId
                      ? "bg-[#ececff] dark:bg-primary/20 text-[#343897] dark:text-primary"
                      : "text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6264a7]/20 text-xs font-semibold text-[#464eb8] dark:text-primary">
                    {getInitials(thread.other_user_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{thread.other_user_name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
                      {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto bg-[#f3f2f1] dark:bg-background p-3">
            {groups.length === 0 && dmThreads.length === 0 ? (
              <div className="mx-auto mt-10 max-w-md rounded-lg border border-dashed border-slate-300 dark:border-input bg-white dark:bg-card p-6 text-center">
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-[#464eb8] dark:text-primary" />
                <p className="text-sm font-medium text-slate-700 dark:text-foreground">No channels yet</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                  You have no department groups. Start a direct message with a colleague.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowDmPicker(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Message a colleague
                </Button>
              </div>
            ) : !selectedGroupId && !selectedDmThreadId ? (
              <div className="mx-auto mt-10 max-w-md rounded-lg border border-dashed border-slate-300 dark:border-input bg-white dark:bg-card p-6 text-center">
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-[#464eb8] dark:text-primary" />
                <p className="text-sm font-medium text-slate-700 dark:text-foreground">Select a channel</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                  Choose a department group or start a direct message.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowDmPicker(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  New message
                </Button>
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="mx-auto mt-10 max-w-md rounded-lg border border-dashed border-slate-300 dark:border-input bg-white dark:bg-card p-6 text-center">
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-[#464eb8] dark:text-primary" />
                <p className="text-sm font-medium text-slate-700 dark:text-foreground">No messages yet</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-muted-foreground">
                  {selectedDmThread ? `Start the conversation with ${selectedDmThread.other_user_name}.` : "Start the conversation with your team."}
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-5xl space-y-1">
                {displayMessages.map((msg) => {
                  const isMine = msg.sender_id === currentUser?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/70 dark:hover:bg-muted/50 ${
                        isMine ? "border-l-2 border-l-[#6264a7] dark:border-l-primary bg-[#ececff]/80 dark:bg-primary/15" : ""
                      }`}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6264a7] text-[11px] font-semibold text-white">
                        {getInitials(msg.sender_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-muted-foreground">
                          <span className="font-semibold text-slate-800 dark:text-foreground">{msg.sender_name}</span>
                          {msg.sender_role && (
                            <span className="rounded-sm bg-slate-200 dark:bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
                              {msg.sender_role.replaceAll("_", " ")}
                            </span>
                          )}
                          <span>{format(new Date(msg.created_at), "h:mm a")}</span>
                          <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-foreground">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollAnchorRef} />
              </div>
            )}
          </div>

          <form onSubmit={onSend} className="border-t border-slate-200 dark:border-border bg-white dark:bg-card p-3">
            <div className="mx-auto max-w-5xl space-y-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={(selectedGroupId || selectedDmThreadId) ? "Type a message" : "Select a channel to send messages"}
                className="min-h-[68px] resize-none rounded-md border-slate-300 dark:border-input bg-white dark:bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary"
                maxLength={2000}
                disabled={!selectedGroupId && !selectedDmThreadId}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-slate-500 dark:text-muted-foreground">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <p className="ml-2 text-xs text-slate-500 dark:text-muted-foreground">Enter to send, Shift+Enter for new line</p>
                </div>
                <Button
                  type="submit"
                  disabled={!canSend}
                  className="bg-[#6264a7] hover:bg-[#5458a0]"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </CardContent>

      {showDmPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-semibold">Message a colleague</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowDmPicker(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {staff.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No other staff found.</p>
              ) : (
                staff.map((s) => {
                  const existingThread = dmThreads.find(
                    (t) => t.other_user_id === s.id
                  );
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => startOrOpenDm(s.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                        {getInitials(s.full_name || "?")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{s.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.role?.replaceAll("_", " ") || "Staff"}
                        </p>
                      </div>
                      {existingThread && (
                        <span className="text-xs text-muted-foreground shrink-0">Open</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
