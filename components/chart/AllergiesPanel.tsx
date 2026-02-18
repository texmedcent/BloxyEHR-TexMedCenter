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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-normal flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Allergies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">No known allergies</p>
        ) : (
          <ul className="space-y-2">
            {list.map((a, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-amber-800">
                  {a.allergen || "Unknown"}
                </span>
                {a.reaction && (
                  <span className="text-slate-600"> — {a.reaction}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
