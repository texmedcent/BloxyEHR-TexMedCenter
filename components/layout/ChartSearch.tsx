"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string | null;
}

interface ChartSearchProps {
  open: boolean;
  onClose: () => void;
}

export function ChartSearch({ open, onClose }: ChartSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const searchPatients = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name, dob, gender")
      .or(
        `mrn.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
      )
      .limit(20);
    setLoading(false);
    if (error) {
      console.error(error);
      setResults([]);
      return;
    }
    setResults(data || []);
  }, [query]);

  useEffect(() => {
    const debounce = setTimeout(() => searchPatients(), 300);
    return () => clearTimeout(debounce);
  }, [query, searchPatients]);

  const openChart = (patientId: string) => {
    router.push(`/chart/${patientId}`);
    onClose();
    setQuery("");
    setResults([]);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed left-0 top-0 bottom-0 w-96 max-w-[90vw] bg-white shadow-xl z-50 flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-500" />
          <Input
            placeholder="Search by MRN, name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0"
            autoFocus
          />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Searching...</div>
          ) : results.length === 0 && query ? (
            <div className="p-4 text-sm text-gray-500">
              No patients found
            </div>
          ) : (
            <ul className="divide-y">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openChart(p.id)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 text-left",
                      "hover:bg-[#1a4d8c]/5 transition-colors"
                    )}
                  >
                    <User className="h-5 w-5 text-[#1a4d8c] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {p.last_name}, {p.first_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        MRN: {p.mrn} · DOB:{" "}
                        {p.dob ? format(new Date(p.dob), "MM/dd/yyyy") : "—"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
