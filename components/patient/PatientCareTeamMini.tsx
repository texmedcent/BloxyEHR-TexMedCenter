"use client";

import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRoleLabel } from "@/lib/roles";

export type CareMember = {
  id: string;
  full_name: string | null;
  role: string | null;
};

export function PatientCareTeamMini({ members }: { members: CareMember[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          Care team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.length === 0 && (
          <p className="text-xs text-slate-500">Your care team will appear here as you see providers.</p>
        )}
        {members.map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-200 dark:border-border px-3 py-2">
            <p className="text-sm font-medium">{m.full_name || "Provider"}</p>
            <p className="text-xs text-slate-500">{formatRoleLabel(m.role)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
