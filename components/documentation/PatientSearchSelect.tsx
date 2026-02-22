"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
interface PatientSearchSelectProps {
  onSelect: (patientId: string) => void;
}

export function PatientSearchSelect({ onSelect }: PatientSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; mrn: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("patients")
        .select("id, mrn, first_name, last_name")
        .or(`mrn.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(8);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by MRN or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex justify-between"
              >
                <span>{p.last_name}, {p.first_name}</span>
                <span className="text-gray-500 text-sm">MRN: {p.mrn}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && query && (
        <p className="text-sm text-gray-500 mt-1">Searching...</p>
      )}
    </div>
  );
}
