"use client";

import { useState } from "react";
import { LayoutGrid, ClipboardList, Megaphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "tasks" | "communications" | "directory";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "tasks", label: "Tasks & Shifts", icon: ClipboardList },
  { id: "communications", label: "Announcements & Events", icon: Megaphone },
  { id: "directory", label: "Directory", icon: Users },
];

interface StaffDashboardTabsProps {
  overviewContent: React.ReactNode;
  tasksContent: React.ReactNode;
  communicationsContent: React.ReactNode;
  directoryContent: React.ReactNode;
}

export function StaffDashboardTabs({
  overviewContent,
  tasksContent,
  communicationsContent,
  directoryContent,
}: StaffDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const content = {
    overview: overviewContent,
    tasks: tasksContent,
    communications: communicationsContent,
    directory: directoryContent,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-white dark:bg-card text-slate-900 dark:text-foreground shadow-sm"
                : "text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-[400px]">{content[activeTab]}</div>
    </div>
  );
}
