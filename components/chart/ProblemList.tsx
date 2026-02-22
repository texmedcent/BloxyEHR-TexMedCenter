"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, ClipboardList } from "lucide-react";
import { format } from "date-fns";

interface Problem {
  id: string;
  description: string;
  status: string;
  onset_date: string | null;
  resolved_date: string | null;
}

interface ProblemListProps {
  patientId: string;
  problems: Problem[];
}

export function ProblemList({ patientId, problems: initialProblems }: ProblemListProps) {
  const [problems, setProblems] = useState(initialProblems);
  const [showAdd, setShowAdd] = useState(false);
  const [newDesc, setNewDesc] = useState("");

  const addProblem = async () => {
    if (!newDesc.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("patient_problems")
      .insert({
        patient_id: patientId,
        description: newDesc.trim(),
        status: "active",
      })
      .select()
      .single();
    if (!error && data) {
      setProblems((prev) => [data, ...prev]);
      setNewDesc("");
      setShowAdd(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const updates: { status: string; resolved_date?: string } = { status };
    if (status === "resolved") {
      updates.resolved_date = new Date().toISOString().split("T")[0];
    }
    const { data } = await supabase
      .from("patient_problems")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (data) {
      setProblems((prev) => prev.map((p) => (p.id === id ? data : p)));
    }
  };

  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold tracking-normal flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
          Problem List
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="flex gap-2 mb-4 p-3 rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30">
            <Input
              placeholder="Problem description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProblem()}
              className="rounded-lg"
            />
            <Button size="sm" onClick={addProblem} disabled={!newDesc.trim()} className="bg-[#1a4d8c] hover:bg-[#1a4d8c]/90">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {problems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
            <p className="text-sm text-slate-500 dark:text-muted-foreground">
              No problems documented yet.
            </p>
            {!showAdd && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
                Add first problem
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {problems.map((p) => (
              <li
                key={p.id}
                className={`rounded-lg border p-3 text-sm transition-colors ${
                  p.status === "resolved"
                    ? "border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 text-slate-500 dark:text-muted-foreground"
                    : "border-slate-200 dark:border-border bg-white dark:bg-card"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span>{p.description}</span>
                  <select
                    value={p.status}
                    onChange={(e) => updateStatus(p.id, e.target.value)}
                    className="text-xs rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background px-2 py-1"
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {p.onset_date && (
                  <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1">
                    Onset: {format(new Date(p.onset_date), "MM/dd/yyyy")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
