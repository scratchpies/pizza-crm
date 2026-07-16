"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/dates";

type Contact = {
  id: string;
  name: string;
  tag: string | null;
  contactType: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  _count?: { sales: number; opportunities: number };
  sales?: { eventDate: string | null }[];
};

export default function ContactsClient() {
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [contactType, setContactType] = useState(searchParams.get("contactType") || "");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (contactType) params.set("contactType", contactType);
    params.set("page", String(page));
    const res = await fetch(`/api/contacts?${params.toString()}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setTotal(data.total ?? 0);
    setPageSize(data.pageSize ?? 50);
    setLoading(false);
  }, [q, contactType, page]);

  // Any time the search or filter changes, jump back to page 1 -- staying on
  // e.g. page 4 of a now-much-shorter filtered result would just show "no
  // contacts found" instead of the results.
  useEffect(() => {
    setPage(1);
  }, [q, contactType]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-800">Contacts</h1>
        <Link
          href="/contacts/new"
          className="flex items-center gap-1.5 bg-crust text-white px-4 py-2 rounded-lg font-semibold text-sm"
        >
          <Plus size={16} />
          New contact
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          placeholder="Search name, email, phone, city..."
          className="border border-neutral-200 rounded-lg px-3 py-2 flex-1 min-w-[200px] text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-neutral-100 bg-neutral-50/50 text-neutral-500">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">City</th>
              <th className="p-3 font-medium">Last sale</th>
              <th className="p-3 font-medium">Leads</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={6}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && contacts.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={6}>
                  No contacts found.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="p-3">
                  <Link href={`/contacts/${c.id}`} className="font-medium text-crust hover:underline">
                    {c.name}
                  </Link>
                  {c.tag && (
                    <span className="ml-2 text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                      {c.tag}
                    </span>
                  )}
                </td>
                <td className="p-3 text-neutral-600">{c.email || "—"}</td>
                <td className="p-3 text-neutral-600">{c.phone || "—"}</td>
                <td className="p-3 text-neutral-600">{c.city || "—"}</td>
                <td className="p-3 text-neutral-600">
                  {c.sales && c.sales[0]?.eventDate ? formatDate(c.sales[0].eventDate) : "—"}
                </td>
                <td className="p-3 text-neutral-600">{c._count?.opportunities ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <p className="text-sm text-neutral-500">{total} contact(s)</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 border border-neutral-200 rounded-lg px-2 py-1 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span className="text-neutral-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 border border-neutral-200 rounded-lg px-2 py-1 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
