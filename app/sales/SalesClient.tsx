"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { formatDate } from "@/lib/dates";

type Sale = {
  id: string;
  eventDate: string | null;
  location: string | null;
  guests: number | null;
  totalCost: number | null;
  depositPaid: number | null;
  paidInFull: boolean | null;
  eventStatus: string | null;
  contact: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
  clientNameRaw: string | null;
};

export default function SalesClient() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [upcoming, setUpcoming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (upcoming) params.set("upcoming", "1");
    const res = await fetch(`/api/sales?${params.toString()}`);
    const data = await res.json();
    setSales(data.sales || []);
    setLoading(false);
  }, [upcoming]);

  useEffect(() => {
    load();
  }, [load]);

  // Sort by event date, nulls always last regardless of direction.
  const sortedSales = useMemo(() => {
    const withDate = sales.filter((s) => s.eventDate);
    const withoutDate = sales.filter((s) => !s.eventDate);
    withDate.sort((a, b) => {
      const diff = new Date(a.eventDate as string).getTime() - new Date(b.eventDate as string).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
    return [...withDate, ...withoutDate];
  }, [sales, sortDir]);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalCost || 0), 0);
  const outstanding = sales.reduce((sum, s) => {
    if (s.paidInFull) return sum;
    const owed = (s.totalCost || 0) - (s.depositPaid || 0);
    return sum + Math.max(owed, 0);
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Sales</h1>
        <Link href="/sales/new" className="bg-crust text-white px-4 py-2 rounded font-semibold">
          + New sale
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Sales" value={sales.length} />
        <StatCard label="Total revenue" value={`$${totalRevenue.toLocaleString()}`} />
        <StatCard label="Outstanding balance" value={`$${outstanding.toLocaleString()}`} />
        <StatCard
          label="Paid in full"
          value={`${sales.filter((s) => s.paidInFull).length}/${sales.length}`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} />
        Upcoming only
      </label>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b bg-neutral-50">
              <th className="p-3">
                <button
                  className="flex items-center gap-1 hover:text-neutral-700"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Date
                  <ArrowUpDown size={13} />
                </button>
              </th>
              <th className="p-3">Client</th>
              <th className="p-3">From lead</th>
              <th className="p-3">Location</th>
              <th className="p-3">Guests</th>
              <th className="p-3">Total</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={8}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={8}>
                  No sales found.
                </td>
              </tr>
            )}
            {sortedSales.map((s) => {
              const balance = (s.totalCost || 0) - (s.depositPaid || 0);
              return (
                <tr key={s.id} className="border-b hover:bg-neutral-50">
                  <td className="p-3">
                    <Link href={`/sales/${s.id}`} className="text-crust hover:underline font-medium">
                      {formatDate(s.eventDate)}
                    </Link>
                  </td>
                  <td className="p-3">
                    {s.contact ? (
                      <Link href={`/contacts/${s.contact.id}`} className="hover:underline">
                        {s.contact.name}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">{s.clientNameRaw || "—"}</span>
                    )}
                  </td>
                  <td className="p-3 text-neutral-500">{s.opportunity?.name || "—"}</td>
                  <td className="p-3">{s.location || "—"}</td>
                  <td className="p-3">{s.guests ?? "—"}</td>
                  <td className="p-3">{s.totalCost != null ? `$${Number(s.totalCost).toLocaleString()}` : "—"}</td>
                  <td className="p-3">
                    {s.paidInFull ? (
                      <span className="text-basil">Paid</span>
                    ) : balance > 0 ? (
                      `$${balance.toLocaleString()} due`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">{s.eventStatus || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-2xl font-bold text-crust">{value}</div>
      <div className="text-xs text-neutral-500 mt-1">{label}</div>
    </div>
  );
}
