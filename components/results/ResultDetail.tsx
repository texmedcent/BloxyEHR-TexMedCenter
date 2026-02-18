import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

interface ResultDetailProps {
  result: {
    id: string;
    type: string;
    value: unknown;
    reported_at: string;
    status: string;
  };
}

export function ResultDetail({ result }: ResultDetailProps) {
  const valueDisplay =
    typeof result.value === "object" && result.value
      ? JSON.stringify(result.value, null, 2)
      : String(result.value);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-2">
          <span className="font-medium capitalize">{result.type}</span>
          <span className="text-sm text-gray-500 inline-flex items-center gap-2">
            {format(new Date(result.reported_at), "MM/dd/yyyy HH:mm")}
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                result.status === "final"
                  ? "bg-emerald-50 text-emerald-700"
                  : result.status === "preliminary"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {result.status}
            </span>
          </span>
        </div>
        <pre className="text-sm bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap">
          {valueDisplay}
        </pre>
      </CardContent>
    </Card>
  );
}
