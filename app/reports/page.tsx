import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Clock, CalendarClock, BarChart3, XCircle, Calculator, CalendarX } from "lucide-react";
import { formatDate, toDateInputValue } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string; month?: string; year?: string };
}) {
  const tab = searchParams.tab || "stale";
  const now = new Date();
  // null = all years combined. Used by the "Lost (non-conflict)" tab,
  // filtered on the requested event's year (not when it was marked lost).
  const selectedYear = searchParams.year ? Number(searchParams.year) : null;
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

  const [staleLeads, upcomingSales, upcomingLeadDates, demandLeadDates, demandAllSales, lostNonConflict, allSalesStats, pastLeadsWithDate] = await Promise.all([
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
      select: { id: true, eventDate: true },
      take: 5000,
    }),
    // Every sale's event date + which lead (if any) it's linked to. Fetched
    // separately from the "unlinked-only" approach below because a sale can
    // be linked to a lead whose OWN eventDate was never filled in (common in
    // the historical import, which matched sales to leads by contact + date
    // proximity, not by copying the date onto the lead record) -- in that
    // case the sale is the only place this date exists at all.
    prisma.sale.findMany({
      where: { eventDate: { not: null } },
      select: { eventDate: true, opportunityId: true },
      take: 5000,
    }),
    // Lost/Abandoned leads NOT lost to a simple date conflict (i.e. we
    // weren't already booked that day) -- these are the ones actually worth
    // digging into (price, competitor, features, or no reason logged at all).
    // Prisma's `not` on a nullable field doesn't automatically catch NULLs,
    // so those are included explicitly.
    prisma.opportunity.findMany({
      where: {
        status: { in: ["Lost", "Abandoned"] },
        OR: [{ lossReason: { not: "Conflict Date" } }, { lossReason: null }],
      },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    // Raw guests/totalCost for every sale, for the Guest & Revenue Stats tab.
    prisma.sale.findMany({
      select: { eventDate: true, guests: true, totalCost: true },
      take: 5000,
    }),
    // Every lead whose requested date has already passed -- regardless of
    // status -- for the "Missed opportunities" tab. Only past dates count:
    // a future lead can still turn into a sale, so it's not "missed" yet.
    prisma.opportunity.findMany({
      where: { eventDate: { lt: todayUTC, not: null } },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { eventDate: "desc" },
      take: 2000,
    }),
  ]);

  // Filtered by the year of the requested event date (not the year it was
  // marked lost -- there's no separate "lostAt" timestamp on record, and the
  // event year is the more stable, meaningful business timeline anyway).
  const lostYears = Array.from(
    new Set(lostNonConflict.filter((o) => o.eventDate).map((o) => new Date(o.eventDate as Date).getUTCFullYear()))
  ).sort((a, b) => b - a);
  const filteredLostLeads = selectedYear
    ? lostNonConflict.filter((o) => o.eventDate && new Date(o.eventDate).getUTCFullYear() === selectedYear)
    : lostNonConflict;
  const lostNonConflictValue = filteredLostLeads.reduce((sum, o) => sum + Number(o.value || 0), 0);

  // Combine leads + sales into one demand list, without double-counting a
  // sale whose linked lead's own eventDate already represents that date.
  // A sale only needs to be skipped if its linked opportunity was ALSO
  // counted via demandLeadDates -- if the link exists but that opportunity
  // had no eventDate of its own (common in historical/imported data), the
  // sale is the only record of that date and must still be counted.
  const countedOpportunityIds = new Set(demandLeadDates.map((o) => o.id));
  const demandSalesToCount = demandAllSales.filter(
    (s) => !s.opportunityId || !countedOpportunityIds.has(s.opportunityId)
  );
  const allDemandDates = [...demandLeadDates, ...demandSalesToCount];

  // Aggregate onto a generic 31-day month (day-of-month, across every year
  // of data) so patterns like "the 1st of the month is popular" or "this
  // month is consistently our busiest" show up regardless of which year.
  const dayCounts = Array.from({ length: 31 }, () => 0);
  for (const o of allDemandDates) {
    if (!o.eventDate) continue;
    const d = new Date(o.eventDate);
    if (d.getUTCMonth() !== selectedMonth - 1) continue;
    dayCounts[d.getUTCDate() - 1] += 1;
  }
  const demandTotal = dayCounts.reduce((a, b) => a + b, 0);
  const maxDayCount = Math.max(...dayCounts, 1);
  const peakDay = dayCounts.indexOf(maxDayCount) + 1;

  // Missed opportunities: past dates where at least one lead wanted that
  // date but no Sale exists for that same date -- i.e. we had the demand and
  // ended up idle instead of booked. Built from a set of every date that DID
  // result in a sale (from demandAllSales, already fetched above), then any
  // past lead whose date isn't in that set represents a missed date.
  const bookedDateKeys = new Set(demandAllSales.filter((s) => s.eventDate).map((s) => toDateInputValue(s.eventDate)));
  const missedLeads = pastLeadsWithDate.filter(
    (o) => o.eventDate && !bookedDateKeys.has(toDateInputValue(o.eventDate))
  );
  const missedByDate = new Map<string, typeof missedLeads>();
  for (const o of missedLeads) {
    const key = toDateInputValue(o.eventDate);
    const list = missedByDate.get(key) || [];
    list.push(o);
    missedByDate.set(key, list);
  }
  const missedYears = Array.from(new Set(missedLeads.map((o) => new Date(o.eventDate as Date).getUTCFullYear()))).sort(
    (a, b) => b - a
  );
  const missedDateEntries = Array.from(missedByDate.entries())
    .filter(([key]) => !selectedYear || Number(key.slice(0, 4)) === selectedYear)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const missedTotalValue = missedDateEntries.reduce(
    (sum, [, leads]) => sum + leads.reduce((s, o) => s + Number(o.value || 0), 0),
    0
  );

  // Guest & Revenue Stats tab -- filtered by the sale's event year, defaults
  // to every year combined. Reuses the same ?year= param as the Lost tab.
  const saleYears = Array.from(
    new Set(allSalesStats.filter((s) => s.eventDate).map((s) => new Date(s.eventDate as Date).getUTCFullYear()))
  ).sort((a, b) => b - a);
  const filteredSalesStats = selectedYear
    ? allSalesStats.filter((s) => s.eventDate && new Date(s.eventDate).getUTCFullYear() === selectedYear)
    : allSalesStats;
  const guestValues = filteredSalesStats.filter((s) => s.guests != null).map((s) => Number(s.guests));
  const revenueValues = filteredSalesStats.filter((s) => s.totalCost != null).map((s) => Number(s.totalCost));
  const guestStats = computeStats(guestValues);
  const revenueStats = computeStats(revenueValues);

  const tabs = [
    { key: "stale", label: "Stale leads", count: staleLeads.length, icon: Clock },
    { key: "events", label: "Upcoming", count: upcomingSales.length + upcomingLeadDates.length, icon: CalendarClock },
    { key: "demand", label: "Demand by day", count: allDemandDates.length, icon: BarChart3 },
    { key: "lost", label: "Lost (non-conflict)", count: lostNonConflict.length, icon: XCircle },
    { key: "missed", label: "Missed opportunities", count: missedDateEntries.length, icon: CalendarX },
    { key: "stats", label: "Guest & Revenue Stats", count: allSalesStats.length, icon: Calculator },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-800 mb-4">Reports</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
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
            Every lead&apos;s requested event date (won, lost, abandoned, or still open), plus any booked sale not
            tied to a lead record, for {MONTH_NAMES[selectedMonth - 1]}, grouped by day of the month across every
            year on record. Use this to spot which months and which days within a month get the most requests --
            a signal for where it might be worth expanding capacity.
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
      {tab === "lost" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Lost or abandoned leads where the reason wasn&apos;t simply a date conflict (we weren&apos;t already
            booked) -- these are the ones worth digging into: price, competitor, missing features, or no reason
            logged at all. Filtered by the year of the requested event.
          </p>

          {lostYears.length > 0 && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <Link
                href="/reports?tab=lost"
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedYear === null
                    ? "bg-crust text-white"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                }`}
              >
                All years
              </Link>
              {lostYears.map((y) => (
                <Link
                  key={y}
                  href={`/reports?tab=lost&year=${y}`}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedYear === y
                      ? "bg-crust text-white"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-3 flex items-center justify-between">
            <span className="text-sm text-neutral-600">{filteredLostLeads.length} lead(s)</span>
            <span className="text-sm font-medium text-neutral-800">
              ${lostNonConflictValue.toLocaleString()} in estimated value
            </span>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {filteredLostLeads.map((o) => (
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
                    · {o.status}
                    {o.eventDate ? ` · ${formatDate(o.eventDate)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block text-xs font-medium bg-sauce/10 text-sauce px-2 py-0.5 rounded-full">
                    {o.lossReason || "No reason logged"}
                  </div>
                  {o.value != null && (
                    <div className="text-neutral-500 mt-1">${Number(o.value).toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
            {filteredLostLeads.length === 0 && (
              <p className="p-3 text-sm text-neutral-500">
                No lost/abandoned leads outside of date conflicts{selectedYear ? ` in ${selectedYear}` : ""}.
              </p>
            )}
          </div>
        </div>
      )}
      {tab === "missed" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Past dates where one or more leads wanted that date, but no sale ended up happening -- capacity that
            went idle instead of booked. Only past dates are shown, since a future lead can still convert. Filtered
            by the year of the requested date.
          </p>

          {missedYears.length > 0 && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <Link
                href="/reports?tab=missed"
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedYear === null
                    ? "bg-crust text-white"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                }`}
              >
                All years
              </Link>
              {missedYears.map((y) => (
                <Link
                  key={y}
                  href={`/reports?tab=missed&year=${y}`}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedYear === y
                      ? "bg-crust text-white"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-3 flex items-center justify-between">
            <span className="text-sm text-neutral-600">{missedDateEntries.length} missed date(s)</span>
            <span className="text-sm font-medium text-neutral-800">
              ${missedTotalValue.toLocaleString()} in estimated value
            </span>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {missedDateEntries.map(([dateKey, leads]) => (
              <div key={dateKey} className="p-3 text-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-neutral-800">{formatDate(dateKey)}</span>
                  <span className="text-xs text-neutral-500">
                    {leads.length} lead{leads.length > 1 ? "s" : ""} requested this date
                  </span>
                </div>
                <div className="space-y-1">
                  {leads.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs text-neutral-500 pl-0.5">
                      <span>
                        {o.contact ? (
                          <Link href={`/contacts/${o.contact.id}`} className="hover:underline">
                            {o.contact.name}
                          </Link>
                        ) : (
                          o.customerNameRaw || o.name
                        )}{" "}
                        · {o.status}
                        {o.lossReason ? ` (${o.lossReason})` : ""}
                      </span>
                      {o.value != null && <span>${Number(o.value).toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {missedDateEntries.length === 0 && (
              <p className="p-3 text-sm text-neutral-500">
                No missed dates found{selectedYear ? ` in ${selectedYear}` : ""} -- every past requested date either
                converted to a sale or hasn&apos;t happened yet.
              </p>
            )}
          </div>
        </div>
      )}
      {tab === "stats" && (
        <div>
          <p className="text-sm text-neutral-600 mb-3">
            Low, high, mean, median, and mode across every booked sale -- for guest count and total sale value.
            Filter by year to compare one season against another.
          </p>

          {saleYears.length > 0 && (
            <div className="flex gap-1.5 mb-4 flex-wrap">
              <Link
                href="/reports?tab=stats"
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedYear === null
                    ? "bg-crust text-white"
                    : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                }`}
              >
                All years
              </Link>
              {saleYears.map((y) => (
                <Link
                  key={y}
                  href={`/reports?tab=stats&year=${y}`}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    selectedYear === y
                      ? "bg-crust text-white"
                      : "bg-white border border-neutral-200 text-neutral-600 hover:border-crust/40"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatsCard title="Guests per sale" stats={guestStats} format={(n) => n.toLocaleString()} />
            <StatsCard title="Total sale value" stats={revenueStats} format={(n) => `$${n.toLocaleString()}`} />
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

type Stats = { low: number; high: number; mean: number; median: number; modes: number[]; n: number };

// Standard five-number-ish summary. Mode returns every value tied for most
// frequent -- if nothing repeats (common for dollar amounts), that's shown
// as "no repeats" rather than picking an arbitrary value.
function computeStats(raw: number[]): Stats | null {
  if (raw.length === 0) return null;
  const values = [...raw].sort((a, b) => a - b);
  const n = values.length;
  const low = values[0];
  const high = values[n - 1];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 1 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;

  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const modes = maxFreq > 1 ? [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v).sort((a, b) => a - b) : [];

  return { low, high, mean, median, modes, n };
}

function StatsCard({
  title,
  stats,
  format,
}: {
  title: string;
  stats: Stats | null;
  format: (n: number) => string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <h2 className="font-semibold text-neutral-800 mb-1">{title}</h2>
      {!stats ? (
        <p className="text-sm text-neutral-500">No data for this selection.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-400 mb-3">Based on {stats.n} sale(s)</p>
          <div className="divide-y divide-neutral-100 text-sm">
            <Row label="Low" value={format(stats.low)} />
            <Row label="High" value={format(stats.high)} />
            <Row label="Mean" value={format(Math.round(stats.mean * 100) / 100)} />
            <Row label="Median" value={format(stats.median)} />
            <Row
              label="Mode"
              value={stats.modes.length > 0 ? stats.modes.map(format).join(" / ") : "No repeats"}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800">{value}</span>
    </div>
  );
}
