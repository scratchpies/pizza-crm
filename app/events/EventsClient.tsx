"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Event = {
  id: string;
  eventDate: string | null;
  location: string | null;
  guests: number | null;
  totalCost: number | null;
  eventStatus: string | null;
  contact: { id: string; name: string } | null;
  clientNameRaw: string | null;
};

export default function EventsClient() {
  const [events, setEvents] = useState<Event[]>([]);
  const [upcoming, setUpcoming] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (upcoming) params.set("upcoming", "1");
    const res = await fetch(`/api/events?${params.toString()}`);
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }, [upcoming]);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue = events.reduce((sum, e) => sum + (e.totalCost || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Event history</h1>

      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={upcoming} onChange={(e) => setUpcoming(e.target.checked)} />
          Upcoming only
        </label>
        <span className="text-sm text-neutral-500">
          {events.length} event(s) · ${totalRevenue.toLocaleString()} total
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b bg-neutral-50">
              <th className="p-3">Date</th>
              <th className="p-3">Client</th>
              <th className="p-3">Location</th>
              <th className="p-3">Guests</th>
              <th className="p-3">Total</th>
              <th className="p-3">Status</th>
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
            {!loading && events.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={6}>
                  No events found.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-b hover:bg-neutral-50">
                <td className="p-3">{e.eventDate ? new Date(e.eventDate).toLocaleDateString() : "—"}</td>
                <td className="p-3">
                  {e.contact ? (
                    <Link href={`/contacts/${e.contact.id}`} className="text-crust hover:underline">
                      {e.contact.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-400">{e.clientNameRaw || "—"}</span>
                  )}
                </td>
                <td className="p-3">{e.location || "—"}</td>
                <td className="p-3">{e.guests ?? "—"}</td>
                <td className="p-3">{e.totalCost != null ? `$${Number(e.totalCost).toLocaleString()}` : "—"}</td>
                <td className="p-3">{e.eventStatus || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
