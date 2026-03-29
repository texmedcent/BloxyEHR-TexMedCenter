"use client";

import type { ReactNode } from "react";
import { BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ActionItem = { key: string; title: string; details: string };

export type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  created_at: string;
};

type PatientActionCenterProps = {
  actionItems: ActionItem[];
  tasks: TaskRow[];
  formatDue: (iso: string | null) => string;
  headerActions?: ReactNode;
  onActionItemClick?: (item: ActionItem) => void;
};

export function PatientActionCenter({
  actionItems,
  tasks,
  formatDue,
  headerActions,
  onActionItemClick,
}: PatientActionCenterProps) {
  return (
    <Card className="border-amber-200/80 dark:border-amber-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BellRing className="h-4 w-4 text-amber-600" />
          Action Center
        </CardTitle>
        <p className="text-xs text-slate-500">Provider updates and account actions</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {headerActions && <div className="flex flex-col gap-2 pb-2 border-b border-slate-200 dark:border-border">{headerActions}</div>}
        {actionItems.map((item) => {
          const interactive = Boolean(onActionItemClick);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onActionItemClick?.(item)}
              className={`w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-left ${
                interactive
                  ? "hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{item.title}</p>
              {item.details ? <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/90">{item.details}</p> : null}
            </button>
          );
        })}
        {tasks.slice(0, 8).map((task) => (
          <div key={task.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{task.title}</p>
              <span className="text-[11px] uppercase text-slate-500">{task.status}</span>
            </div>
            {task.details && <p className="mt-1 text-xs text-slate-600">{task.details}</p>}
            <p className="mt-1 text-xs text-slate-500">{formatDue(task.due_at)}</p>
          </div>
        ))}
        {actionItems.length === 0 && tasks.length === 0 && (
          <p className="text-sm text-slate-500">No pending tasks. You are all caught up.</p>
        )}
      </CardContent>
    </Card>
  );
}
