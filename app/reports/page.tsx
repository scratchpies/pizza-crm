import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Clock, CalendarClock, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string; month?: string };
}) {
  const tab = searchParams.tab || "stale";
  const now = new Date();
  // 1-12. Defaults to the current month. Used by the "Demand by day" tab --
  // deliberately not tied to a specific year, since the whole point is to
  // aggregate every year's leads onto one generic month to spot patterns.
  const selectedMonth = Math.min(12, Math.max(1, Number(searchParams.month) || now.getUTCMonth() + 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // Anchor on UTC midnight of today, not the exact request timestamp --
  // eventDate is always stored as UTC midnight, so comparing it against the
  // live clock silently drops today's events once UTC rolls past midnight
  // (mid-afternoon in US timezones).
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const sixtyDaysAhead = new Date(todayUTC.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [staleLeads, upcomingSales, upcomingLeadDates, demandLeadDates] = await Promise.all([
    prisma.opportunity
      .findMany({
        where: { status: { in: ["Open", "Negotiation", "Follow-up"] } },
        include: {
          contact: { select: { id: true, name: true, phone: true, email: true } },
          attempts: { orderBy: { contactedAt: "desc" }, take: 1 },
        },
        take: 500,
      })
      .then((leads) =>
        leads
          // Stale = never contacted at all, or last real outreach touch was
          // 30+ days ago. Uses the actual ContactAttempt log (same source the
          // Leads tab's staleness color-coding uses) instead of the
          // Opportunity's generic updatedAt, which bumps on any field edit
          // (stage, priority, notes...) whether or not you actually reached out.
          .filter((o) => {
            const lastContacted = o.attempts[0]?.contactedAt;
            return !lastContacted || lastContacted.getTime() < thirtyDaysAgo.getTime();
          })
          .sort((a, b) => (a.attempts[0]?.contactedAt?.getTime() ?? 0) - (b.attempts[0]?.contactedAt?.getTime() ?? 0))
      ),
    prisma.sale.findMany({
      where: { eventDate: { gte: todayUTC, lte: sixtyDaysAhead } },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { eventDate: "asc" },
      take: 500,
    }),
    prisma.opportunity.findMany({
      where: { eventDate: { gte: todayUTC, lte: sixtyDaysAhead }, status: { in: ["Open", "Negotiation"] } },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { eventDate: "asc" },
      take: 500,
    }),
    // Every lead's requested event date, regardless of outcome (Won, Lost,
    // Abandoned, still Open) -- a Lost lead still represents real demand for
    // that date, which is exactly what "should we expand for busy months"
    // needs to see, not just the leads that turned into bookings.
    prisma.opportunity.findMany({
      where: { eventDate: { not: null } },
      select: { eventDate: true },
      take: 5000,
    }),
  ]);

  // Aggregate onto a generic 31-day month (day-of-month, across every year
  // of data) so patterns like "the 1st of the month is popular" or "this
  // month is consistently our busiest" show up regardless of which year.
  const dayCounts = Array.from({ length: 31 }, () => 0);
  for (const o of demandLeadDates) {
    if (!o.eventDate) continue;
    const d = new Date(o.eventDate);
    if (d.getUTCMonth() !== selectedMonth - 1) continue;
    dayCounts[d.getUTCDate() - 1] += 1;
  }
  const demandTotal = dayCounts.reduce((a, b) => a + b, 0);
  const maxDayCount = Math.max(...dayCounts, 1);
  const peakDay = dayCounts.indexOf(maxDayCount) + 1;

  const tabs = [
    { key: "stale", label: "Stale leads", count: staleLeads.length, icon: Clock },
    { key: "events", label: "Upcoming", count: upcomingSales.length + upcomingLeadDates.length, icon: CalendarClock },
    { key: "demand", label: "Demand by day", count: demandLeadDates.length, icon: BarChart3 },
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

      {tab === "stale" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Open leads that haven&apos;t actually been contacted in 30+ days (or never at all). Worth a follow-up
            or marking as lost.
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
                  {o.attempts[0]?.contactedAt
                    ? `Last contacted ${formatDate(o.attempts[0].contactedAt)}`
                    : "Never contacted"}
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

      {tab === "demand" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Every lead&apos;s requested event date (won, lost, abandoned, or still open) for {MONTH_NAMES[selectedMonth - 1]}
            , grouped by day of the month across every year on record. Use this to spot which months and which
            days within a month get the most requests -- a signal for where it might be worth expanding capacity.
          </p>

          <div className="flex gap-1.5 mb-4 flex-wrap">
            {MONTH_NAMES.map((name, i) => (
              <Link
                key={name}
                href={`/reports?tab=demand&month=${i + 1}`}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedMonth === i + 1
                    ? "bg-crust text-white"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                }`}
              >
                {name.slice(0, 3)}
              </Link>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-neutral-800">
                {MONTH_NAMES[selectedMonth - 1]} -- requests by day
              </h2>
              <span className="text-sm text-neutral-500">
                {demandTotal} total{demandTotal > 0 ? ` · busiest: the ${peakDay}${ordinalSuffix(peakDay)}` : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-40 min-w-[620px]">
                {dayCounts.map((count, i) => (
                  <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                    <span className="text-[9px] text-neutral-400">{count > 0 ? count : ""}</span>
                    <div
                      className={`w-full rounded-t ${count === maxDayCount && count > 0 ? "bg-crust" : "bg-crust/40"}`}
                      style={{ height: `${Math.max((count / maxDayCount) * 100, count > 0 ? 4 : 1)}%` }}
                      title={`${MONTH_NAMES[selectedMonth - 1]} ${i + 1}: ${count} lead(s)`}
                    />
                    <span className="text-[9px] text-neutral-400">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            {demandTotal === 0 && (
              <p className="text-sm text-neutral-500 mt-3">No leads on record requesting a date in this month.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
