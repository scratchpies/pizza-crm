// Read-only query helpers that back the Chat tab's Claude tool calls (see
// app/api/chat/route.ts). Kept separate from the Reports page so the two can
// evolve independently -- the Reports page renders straight to JSX for a
// human, these return small, LLM-friendly JSON objects.
//
// Deliberately excludes email/phone/address from every result, even though
// contact *names* are allowed through -- names make answers useful ("Sarah
// Jenkins hasn't been contacted in 12 days"), but there's no reason for a
// third-party API call to ever see a customer's email or phone number just
// to answer a business question about leads/sales trends.

import { prisma } from "@/lib/prisma";

function todayUTCStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function yearRange(year: number): { gte: Date; lt: Date } {
  return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
}

function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function getOverviewStats() {
  const todayUTC = todayUTCStart();
  const [
    totalContacts,
    currentCustomers,
    potentialCustomers,
    openLeads,
    totalLeadsEverLogged,
    totalSalesEverBooked,
    revenueAgg,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { contactType: "Current Customer" } }),
    prisma.contact.count({ where: { contactType: "Potential Customer" } }),
    prisma.opportunity.count({ where: { status: { in: ["Open", "Negotiation"] } } }),
    prisma.opportunity.count(),
    prisma.sale.count(),
    prisma.sale.aggregate({ _sum: { totalCost: true } }),
  ]);

  return {
    asOfDate: dateStr(todayUTC),
    totalContacts,
    currentCustomers,
    potentialCustomers,
    openLeads,
    totalLeadsEverLogged,
    totalSalesEverBooked,
    winRatePct:
      totalLeadsEverLogged > 0 ? Number(((totalSalesEverBooked / totalLeadsEverLogged) * 100).toFixed(1)) : null,
    allTimeRevenue: Number(revenueAgg._sum.totalCost || 0),
  };
}

export async function searchLeads(params: {
  statuses?: string[];
  year?: number;
  staleOnly?: boolean;
  limit?: number;
}) {
  const { statuses, year, staleOnly, limit = 50 } = params;
  const where: Record<string, unknown> = {};
  if (statuses && statuses.length > 0) where.status = { in: statuses };
  if (year) where.eventDate = yearRange(year);

  const leads = await prisma.opportunity.findMany({
    where,
    include: {
      contact: { select: { name: true } },
      attempts: { orderBy: { contactedAt: "desc" }, take: 1 },
    },
    orderBy: { eventDate: "desc" },
    take: Math.min(limit, 200),
  });

  const now = Date.now();
  const rows = leads.map((o) => {
    const lastContacted = o.attempts[0]?.contactedAt ?? null;
    const daysSinceLastContact = lastContacted ? Math.floor((now - lastContacted.getTime()) / 86400000) : null;
    return {
      id: o.id,
      name: o.contact?.name || o.customerNameRaw || o.name,
      status: o.status,
      quotedValue: o.value != null ? Number(o.value) : null,
      requestedEventDate: dateStr(o.eventDate),
      lossReason: o.lossReason,
      daysSinceLastContact,
    };
  });

  const filtered = staleOnly
    ? rows.filter((r) => r.daysSinceLastContact === null || r.daysSinceLastContact >= 30)
    : rows;

  return { count: filtered.length, leads: filtered };
}

export async function searchSales(params: { year?: number; upcomingOnly?: boolean; unpaidOnly?: boolean; limit?: number }) {
  const { year, upcomingOnly, unpaidOnly, limit = 50 } = params;
  const todayUTC = todayUTCStart();
  const where: Record<string, unknown> = {};
  if (year) where.eventDate = yearRange(year);
  if (upcomingOnly) where.eventDate = { ...(where.eventDate as object), gte: todayUTC };
  if (unpaidOnly) where.OR = [{ paidInFull: false }, { paidInFull: null }];

  const sales = await prisma.sale.findMany({
    where,
    include: { contact: { select: { name: true } } },
    orderBy: { eventDate: "desc" },
    take: Math.min(limit, 200),
  });

  const rows = sales.map((s) => {
    const total = Number(s.totalCost || 0);
    const deposit = Number(s.depositPaid || 0);
    return {
      id: s.id,
      name: s.contact?.name || s.clientNameRaw,
      eventDate: dateStr(s.eventDate),
      guests: s.guests,
      totalCost: total,
      depositPaid: deposit,
      balanceDue: total - deposit,
      paidInFull: s.paidInFull,
      eventStatus: s.eventStatus,
      location: s.location,
    };
  });

  return { count: rows.length, sales: rows };
}

export async function getRevenueStats(params: { year?: number }) {
  const { year } = params;
  const sales = await prisma.sale.findMany({
    where: year ? { eventDate: yearRange(year) } : undefined,
    select: { guests: true, totalCost: true },
    take: 5000,
  });

  const guestValues = sales.filter((s) => s.guests != null).map((s) => Number(s.guests));
  const revenueValues = sales.filter((s) => s.totalCost != null).map((s) => Number(s.totalCost));

  function summarize(values: number[]) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      n,
      low: sorted[0],
      high: sorted[n - 1],
      mean: Number((sum / n).toFixed(2)),
      median: n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
      total: sum,
    };
  }

  return {
    year: year ?? "all-time",
    saleCount: sales.length,
    guestStats: summarize(guestValues),
    revenueStats: summarize(revenueValues),
  };
}

export async function getDemandByDay(params: { month: number }) {
  const month = Math.min(12, Math.max(1, params.month));

  const [leadDates, allSales] = await Promise.all([
    prisma.opportunity.findMany({ where: { eventDate: { not: null } }, select: { id: true, eventDate: true } }),
    prisma.sale.findMany({ where: { eventDate: { not: null } }, select: { eventDate: true, opportunityId: true } }),
  ]);

  const countedOpportunityIds = new Set(leadDates.map((o) => o.id));
  const salesToCount = allSales.filter((s) => !s.opportunityId || !countedOpportunityIds.has(s.opportunityId));
  const combined = [...leadDates, ...salesToCount];

  const dayCounts = Array.from({ length: 31 }, () => 0);
  for (const o of combined) {
    if (!o.eventDate) continue;
    const d = new Date(o.eventDate);
    if (d.getUTCMonth() !== month - 1) continue;
    dayCounts[d.getUTCDate() - 1] += 1;
  }
  const total = dayCounts.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...dayCounts, 1);
  const peakDay = dayCounts.indexOf(maxCount) + 1;

  return {
    month,
    totalRequestsAcrossAllYears: total,
    peakDayOfMonth: total > 0 ? peakDay : null,
    countsByDayOfMonth: dayCounts.map((count, i) => ({ day: i + 1, count })).filter((d) => d.count > 0),
  };
}

export async function getMissedOpportunities(params: { year?: number }) {
  const { year } = params;
  const todayUTC = todayUTCStart();

  const [allSales, pastLeads] = await Promise.all([
    prisma.sale.findMany({ where: { eventDate: { not: null } }, select: { eventDate: true } }),
    prisma.opportunity.findMany({
      where: { eventDate: { lt: todayUTC, not: null } },
      include: { contact: { select: { name: true } } },
      orderBy: { eventDate: "desc" },
      take: 2000,
    }),
  ]);

  const bookedDateKeys = new Set(allSales.filter((s) => s.eventDate).map((s) => dateStr(s.eventDate)));
  const missed = pastLeads.filter((o) => o.eventDate && !bookedDateKeys.has(dateStr(o.eventDate)));
  const filtered = year ? missed.filter((o) => new Date(o.eventDate as Date).getUTCFullYear() === year) : missed;

  const missedDates = new Set(filtered.map((o) => dateStr(o.eventDate)));
  const totalValue = filtered.reduce((sum, o) => sum + Number(o.value || 0), 0);

  return {
    year: year ?? "all-time",
    missedDateCount: missedDates.size,
    missedLeadCount: filtered.length,
    estimatedValueLost: totalValue,
    examples: filtered.slice(0, 20).map((o) => ({
      eventDate: dateStr(o.eventDate),
      name: o.contact?.name || o.customerNameRaw || o.name,
      status: o.status,
      lossReason: o.lossReason,
      quotedValue: o.value != null ? Number(o.value) : null,
    })),
  };
}

export async function getOutstandingBalances() {
  const todayUTC = todayUTCStart();
  const sales = await prisma.sale.findMany({
    where: { OR: [{ paidInFull: false }, { paidInFull: null }] },
    include: { contact: { select: { name: true } } },
    orderBy: { eventDate: "asc" },
    take: 1000,
  });

  const rows = sales
    .map((s) => {
      const total = Number(s.totalCost || 0);
      const deposit = Number(s.depositPaid || 0);
      return {
        id: s.id,
        name: s.contact?.name || s.clientNameRaw,
        eventDate: dateStr(s.eventDate),
        balanceDue: total - deposit,
        isPastDue: s.eventDate ? new Date(s.eventDate) < todayUTC : false,
      };
    })
    .filter((s) => s.balanceDue > 0);

  return {
    count: rows.length,
    totalOutstanding: rows.reduce((sum, r) => sum + r.balanceDue, 0),
    rows: rows.slice(0, 50),
  };
}

export async function getMenuPopularity() {
  const sales = await prisma.sale.findMany({
    select: { pizza1: true, pizza2: true, pizza3: true, pizza4: true, additionalPizza: true, additionalItems: true },
    take: 5000,
  });

  const pizzaCounts = new Map<string, { label: string; count: number }>();
  const itemCounts = new Map<string, { label: string; count: number }>();

  function normalize(name: string): string {
    return name.trim().replace(/\s+/g, " ");
  }
  function tallyInto(map: Map<string, { label: string; count: number }>, raw: string | null) {
    const label = raw ? normalize(raw) : "";
    if (!label) return;
    const key = label.toLowerCase();
    const existing = map.get(key);
    map.set(key, { label: existing?.label ?? label, count: (existing?.count ?? 0) + 1 });
  }
  function tallySplit(map: Map<string, { label: string; count: number }>, raw: string | null) {
    if (!raw) return;
    for (const part of raw.split(/[,;]/)) tallyInto(map, part);
  }

  for (const s of sales) {
    tallyInto(pizzaCounts, s.pizza1);
    tallyInto(pizzaCounts, s.pizza2);
    tallyInto(pizzaCounts, s.pizza3);
    tallyInto(pizzaCounts, s.pizza4);
    tallySplit(pizzaCounts, s.additionalPizza);
    tallySplit(itemCounts, s.additionalItems);
  }

  const topPizzas = Array.from(pizzaCounts.values()).sort((a, b) => b.count - a.count).slice(0, 15);
  const topItems = Array.from(itemCounts.values()).sort((a, b) => b.count - a.count).slice(0, 15);

  return { salesCounted: sales.length, topPizzaFlavors: topPizzas, topAdditionalItems: topItems };
}

export async function getLostLeads(params: { year?: number; nonConflictOnly?: boolean }) {
  const { year, nonConflictOnly = true } = params;
  const where: Record<string, unknown> = { status: { in: ["Lost", "Abandoned"] } };
  if (nonConflictOnly) where.OR = [{ lossReason: { not: "Conflict Date" } }, { lossReason: null }];

  const leads = await prisma.opportunity.findMany({
    where,
    include: { contact: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 1000,
  });

  const filtered = year
    ? leads.filter((o) => o.eventDate && new Date(o.eventDate).getUTCFullYear() === year)
    : leads;

  const reasonCounts = new Map<string, number>();
  for (const o of filtered) {
    const reason = o.lossReason || "No reason logged";
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }

  return {
    year: year ?? "all-time",
    count: filtered.length,
    totalEstimatedValue: filtered.reduce((sum, o) => sum + Number(o.value || 0), 0),
    byReason: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })),
    examples: filtered.slice(0, 20).map((o) => ({
      name: o.contact?.name || o.customerNameRaw || o.name,
      eventDate: dateStr(o.eventDate),
      lossReason: o.lossReason,
      quotedValue: o.value != null ? Number(o.value) : null,
    })),
  };
}
