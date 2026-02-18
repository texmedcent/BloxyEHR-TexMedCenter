"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold tracking-normal">Problem List</CardTitle>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {showAdd && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Problem description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProblem()}
            />
            <Button size="sm" onClick={addProblem}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {problems.length === 0 ? (
          <p className="text-sm text-slate-500">No problems documented</p>
        ) : (
          <ul className="space-y-2">
            {problems.map((p) => (
              <li
                key={p.id}
                className={`p-2 rounded border text-sm ${
                  p.status === "resolved" ? "bg-slate-50 text-slate-500" : "bg-white"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <span>{p.description}</span>
                  <select
                    value={p.status}
                    onChange={(e) => updateStatus(p.id, e.target.value)}
                    className="text-xs rounded border px-1 py-0.5"
                  >
                    <option value="active">Active</option>
                    <option value="resolved">Resolved</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {p.onset_date && (
                  <p className="text-xs text-slate-500 mt-1">
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
