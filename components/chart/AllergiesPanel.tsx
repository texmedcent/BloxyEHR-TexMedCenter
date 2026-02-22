import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Allergy {
  allergen?: string;
  reaction?: string;
}

interface AllergiesPanelProps {
  allergies: unknown;
}

export function AllergiesPanel({ allergies }: AllergiesPanelProps) {
  const list = Array.isArray(allergies) ? (allergies as Allergy[]) : [];

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-normal flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          Allergies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">
            No known allergies
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((a, i) => (
              <li
                key={i}
                className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2 text-sm"
              >
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  {a.allergen || "Unknown"}
                </span>
                {a.reaction && (
                  <span className="text-slate-600 dark:text-muted-foreground">
                    {" — "}
                    {a.reaction}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
