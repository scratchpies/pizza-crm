"use client";

import { useEffect, useState } from "react";

type ContactOption = { id: string; name: string; email: string | null; phone: string | null };

export default function ContactPicker({
  currentName,
  onSelect,
}: {
  currentName?: string | null;
  onSelect: (contact: ContactOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactOption[]>([]);

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults((data.contacts || []).slice(0, 8));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-crust hover:underline"
      >
        {currentName ? `Linked: ${currentName} (change)` : "Link to a contact"}
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <input
        autoFocus
        className="border rounded px-2 py-1 text-sm w-48"
        placeholder="Search contacts..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {results.length > 0 && (
        <div className="absolute z-10 bg-white border rounded shadow mt-1 w-64 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <button
              type="button"
              key={c.id}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-neutral-50"
              onMouseDown={() => {
                onSelect(c);
                setOpen(false);
                setQ("");
              }}
            >
              {c.name} {c.email ? <span className="text-neutral-400">· {c.email}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
