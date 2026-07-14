import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { RotateCcw, Clock, CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab || "winback";
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [winback, staleLeads, upcomingSales, upcomingLeadDates] = await Promise.all([
    prisma.contact.findMany({
      where: {
        contactType: "Current Customer",
        doNotEmail: false,
        sales: { none: { eventDate: { gte: ninetyDaysAgo } } },
      },
      include: { sales: { orderBy: { eventDate: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.opportunity.findMany({
      where: {
        status: { in: ["Open", "Negotiation", "Follow-up"] },
        updatedAt: { lt: thirtyDaysAgo },
      },
      include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { updatedAt: "asc" },
      take: 500,
    }),
    prisma.sale.findMany({
      where: { eventDate: { gte: now, lte: sixtyDaysAhead } },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { eventDate: "asc" },
      take: 500,
    }),
    prisma.opportunity.findMany({
      where: { eventDate: { gte: now, lte: sixtyDaysAhead }, status: { in: ["Open", "Negotiation"] } },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { eventDate: "asc" },
      take: 500,
    }),
  ]);

  const tabs = [
    { key: "winback", label: "Win-back", count: winback.length, icon: RotateCcw },
    { key: "stale", label: "Stale leads", count: staleLeads.length, icon: Clock },
    { key: "events", label: "Upcoming", count: upcomingSales.length + upcomingLeadDates.length, icon: CalendarClock },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-800 mb-4">Reports</h1>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/reports?tab=${t.key}`}
            className={`bg-white rounded-xl border p-4 transition-colors ${
              tab === t.key ? "border-crust ring-1 ring-crust/30" : "border-neutral-200 hover:border-crust/40"
            }`}
          >
            <t.icon size={18} className={tab === t.key ? "text-crust" : "text-neutral-400"} />
            <div className="text-2xl font-bold text-neutral-800 mt-2">{t.count}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{t.label}</div>
          </Link>
        ))}
      </div>

      {tab === "winback" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Current customers with no sale in the last 90 days (or none on record). Good candidates for a
            check-in email.
          </p>
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {winback.map((c) => (
              <div key={c.id} className="p-3 text-sm flex justify-between gap-4">
                <Link href={`/contacts/${c.id}`} className="font-medium text-crust hover:underline">
                  {c.name}
                </Link>
                <span className="text-neutral-500">
                  {c.sales[0]?.eventDate
                    ? `Last sale: ${formatDate(c.sales[0].eventDate)}`
                    : "No sale on record"}
                </span>
              </div>
            ))}
            {winback.length === 0 && <p className="p-3 text-sm text-neutral-500">Nobody due for a win-back yet.</p>}
          </div>
        </div>
      )}

      {tab === "stale" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Open leads that haven&apos;t been updated in 30+ days. Worth a follow-up or marking as lost.
          </p>
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {staleLeads.map((o) => (
              <div key={o.id} className="p-3 text-sm flex justify-between gap-4">
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-neutral-500">
                    {o.contact ? (
                      <Link href={`/contacts/${o.contact.id}`} className="hover:underline">
                        {o.contact.name}
                      </Link>
                    ) : (
                      o.customerNameRaw
                    )}{" "}
                    · {o.stage}
                  </div>
                </div>
                <span className="text-neutral-500">
                  Last touched {new Date(o.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {staleLeads.length === 0 && <p className="p-3 text-sm text-neutral-500">No stale leads right now.</p>}
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-semibold mb-2 text-sm text-neutral-700">Booked sales (next 60 days)</h2>
            <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              {upcomingSales.map((s) => (
                <div key={s.id} className="p-3 text-sm flex justify-between gap-4">
                  <div>
                    <Link href={`/sales/${s.id}`} className="font-medium hover:underline">
                      {formatDate(s.eventDate)} · {s.location || ""}
                    </Link>
                    <div className="text-neutral-500">
                      {s.contact ? (
                        <Link href={`/contacts/${s.contact.id}`} className="hover:underline">
                          {s.contact.name}
                        </Link>
                      ) : (
                        s.clientNameRaw
                      )}
                    </div>
                  </div>
                  <span className="text-neutral-500">{s.guests ? `${s.guests} guests` : ""}</span>
                </div>
              ))}
              {upcomingSales.length === 0 && (
                <p className="p-3 text-sm text-neutral-500">No booked sales in the next 60 days.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-2 text-sm text-neutral-700">Open leads with a target date (next 60 days)</h2>
            <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              {upcomingLeadDates.map((o) => (
                <div key={o.id} className="p-3 text-sm flex justify-between gap-4">
                  <div>
                    <div className="font-medium">{o.name}</div>
                    <div className="text-neutral-500">
                      {o.contact ? (
                        <Link href={`/contacts/${o.contact.id}`} className="hover:underline">
                          {o.contact.name}
                        </Link>
                      ) : (
                        o.customerNameRaw
                      )}
                    </div>
                  </div>
                  <span className="text-neutral-500">
                    {o.eventDate ? formatDate(o.eventDate) : ""}
                  </span>
                </div>
              ))}
              {upcomingLeadDates.length === 0 && (
                <p className="p-3 text-sm text-neutral-500">No open leads with a near-term date.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
