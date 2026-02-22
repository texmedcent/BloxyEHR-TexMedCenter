import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface CareTeamMember {
  provider_id: string;
  full_name: string | null;
  added_at: string;
  added_via: string;
}

interface CareTeamPanelProps {
  members: CareTeamMember[];
}

const ADDED_VIA_LABELS: Record<string, string> = {
  encounter_assign: "Encounter assign",
  encounter_edit: "Encounter edit",
  documentation: "Documentation",
  order: "Order",
  disposition: "Disposition",
};

export function CareTeamPanel({ members }: CareTeamPanelProps) {
  const uniqueByProvider = Array.from(
    new Map(members.map((m) => [m.provider_id, m])).values()
  ).sort(
    (a, b) =>
      new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-normal">
          Care Team
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uniqueByProvider.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            No providers assigned yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {uniqueByProvider.map((m) => (
              <li
                key={m.provider_id}
                className="flex items-center justify-between gap-2"
              >
                <span>{m.full_name || "Provider"}</span>
                <span className="text-xs text-slate-500 dark:text-muted-foreground">
                  {ADDED_VIA_LABELS[m.added_via] || m.added_via} ·{" "}
                  {format(new Date(m.added_at), "MM/dd")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
