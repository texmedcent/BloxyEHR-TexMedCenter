"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface RowPatient {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string;
}

interface OrderRow {
  id: string;
  patient_id: string;
  type: string;
  status: string;
}

interface ResultRow {
  id: string;
  patient_id: string;
  type: string;
  status: string;
}

export function DashboardRecentPanels({
  recentOrders,
  recentResults,
  patients,
}: {
  recentOrders: OrderRow[];
  recentResults: ResultRow[];
  patients: RowPatient[];
}) {
  const [orders, setOrders] = useState(recentOrders);
  const [results, setResults] = useState(recentResults);
  const [clearingOrders, setClearingOrders] = useState(false);
  const [clearingResults, setClearingResults] = useState(false);
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const clearOrders = async () => {
    setClearingOrders(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ dashboard_orders_cleared_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    setOrders([]);
    setClearingOrders(false);
  };

  const clearResults = async () => {
    setClearingResults(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ dashboard_results_cleared_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    setResults([]);
    setClearingResults(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-slate-200 dark:border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
            <ClipboardList className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
            Recent Orders
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg"
            onClick={clearOrders}
            disabled={clearingOrders}
          >
            {clearingOrders ? "Clearing..." : "Clear"}
          </Button>
        </CardHeader>
        <CardContent>
          {orders.length ? (
            <div className="space-y-2">
              {orders.map((order) => {
                const patient = patientMap.get(order.patient_id);
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border px-3 py-2 bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{order.type}</p>
                      <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                        {patient
                          ? `${patient.last_name}, ${patient.first_name} (MRN: ${patient.mrn})`
                          : "Unknown patient"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize rounded-md",
                        order.status?.toLowerCase() === "completed" &&
                          "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
                        order.status?.toLowerCase() === "discontinued" &&
                          "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-muted-foreground">No recent orders</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-900 dark:text-foreground">
            <FlaskConical className="h-4 w-4 text-[#1a4d8c] dark:text-primary" />
            Recent Results
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg"
            onClick={clearResults}
            disabled={clearingResults}
          >
            {clearingResults ? "Clearing..." : "Clear"}
          </Button>
        </CardHeader>
        <CardContent>
          {results.length ? (
            <div className="space-y-2">
              {results.map((result) => {
                const patient = patientMap.get(result.patient_id);
                return (
                  <div
                    key={result.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-border px-3 py-2 bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{result.type}</p>
                      <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                        {patient
                          ? `${patient.last_name}, ${patient.first_name} (MRN: ${patient.mrn})`
                          : "Unknown patient"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize rounded-md",
                        result.status?.toLowerCase() === "final" &&
                          "border-[#1a4d8c]/40 bg-[#1a4d8c]/10 text-[#1a4d8c] dark:border-primary/50 dark:bg-primary/20 dark:text-primary",
                        result.status?.toLowerCase() === "preliminary" &&
                          "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                      )}
                    >
                      {result.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-muted-foreground">No recent results</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
