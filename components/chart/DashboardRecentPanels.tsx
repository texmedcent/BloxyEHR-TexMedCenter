"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Orders</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
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
                    className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{order.type}</p>
                      <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                        {patient
                          ? `${patient.last_name}, ${patient.first_name} (MRN: ${patient.mrn})`
                          : "Unknown patient"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Results</CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
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
                    className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{result.type}</p>
                      <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">
                        {patient
                          ? `${patient.last_name}, ${patient.first_name} (MRN: ${patient.mrn})`
                          : "Unknown patient"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
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
