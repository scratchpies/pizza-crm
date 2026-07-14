"use client";

import { useState } from "react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Import failed");
    } else {
      setResult(data);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Import contacts</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Upload a CSV to add or update contacts going forward. Columns (case-insensitive, any order):{" "}
        <code className="bg-neutral-100 px-1 rounded">Name, Email, Phone, ContactType, Tag, City, Zip,
        Country, Assignee, Description</code>. Only <code>Name</code> is required. Existing contacts are
        matched by email and updated; everyone else is added as new.
      </p>

      <div className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block"
        />
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-crust text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Importing..." : "Import"}
        </button>

        {error && <p className="text-sauce text-sm">{error}</p>}
        {result && (
          <p className="text-sm text-basil">
            Done: {result.created} created, {result.updated} updated, {result.skipped} skipped (missing
            name), out of {result.total} rows.
          </p>
        )}
      </div>
    </div>
  );
}
