"use client";

import { useEffect, useState, useCallback } from "react";

export default function ExportPage() {
  const [contactType, setContactType] = useState("");
  const [tag, setTag] = useState("");
  const [requireEmail, setRequireEmail] = useState(true);
  const [preview, setPreview] = useState<{ count: number } | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (contactType) params.set("contactType", contactType);
    if (tag) params.set("tag", tag);
    if (!requireEmail) params.set("requireEmail", "0");
    return params;
  }, [contactType, tag, requireEmail]);

  useEffect(() => {
    const params = buildParams();
    fetch(`/api/export?${params.toString()}`)
      .then((r) => r.json())
      .then(setPreview);
  }, [buildParams]);

  const downloadUrl = `/api/export?${buildParams().toString()}&format=csv`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Export for Omnisend</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Builds a CSV formatted for Omnisend&apos;s contact import (Email, First/Last Name, Phone, City,
        Country, Postal Code, plus Tag and Contact Type as custom properties). Contacts marked
        &quot;Do not email&quot; are always excluded.
      </p>

      <div className="bg-white rounded-lg shadow p-6 space-y-4 max-w-lg">
        <label className="block">
          <span className="block text-sm font-medium mb-1">Contact type</span>
          <select
            className="border rounded px-3 py-2 w-full"
            value={contactType}
            onChange={(e) => setContactType(e.target.value)}
          >
            <option value="">All</option>
            <option value="Current Customer">Current Customer</option>
            <option value="Potential Customer">Potential Customer</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">Tag (optional)</span>
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="e.g. VIP, Repeat, Wedding"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requireEmail} onChange={(e) => setRequireEmail(e.target.checked)} />
          Only include contacts with an email address
        </label>

        <div className="pt-2 border-t">
          <p className="text-sm text-neutral-600 mb-3">
            {preview ? `${preview.count} contact(s) match this segment.` : "Loading..."}
          </p>
          <a
            href={downloadUrl}
            className="inline-block bg-crust text-white px-4 py-2 rounded font-semibold"
          >
            Download CSV
          </a>
        </div>
      </div>
    </div>
  );
}
