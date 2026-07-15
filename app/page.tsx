import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserPlus,
  Target,
  Clock,
  CalendarClock,
  DollarSign,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    totalContacts,
    currentCustomers,
    potentialCustomers,
    openLeads,
    upcomingSales,
    staleLeads,
    salesThisYear,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { contactType: "Current Customer" } }),
    prisma.contact.count({ where: { contactType: "Potential Customer" } }),
    prisma.opportunity.count({ where: { status: { in: ["Open", "Negotiation"] } } }),
    prisma.sale.count({ where: { eventDate: { gte: now, lte: sixtyDaysAhead } } }),
    prisma.opportunity
      .findMany({
        where: { status: { in: ["Open", "Negotiation", "Follow-up"] } },
        select: { attempts: { orderBy: { contactedAt: "desc" }, take: 1, select: { contactedAt: true } } },
        take: 1000,
      })
      // Same "stale" definition as the Reports tab: never contacted, or last
      // real outreach touch was 30+ days ago -- not just "not edited lately."
      .then(
        (leads) =>
          leads.filter((o) => {
            const lastContacted = o.attempts[0]?.contactedAt;
            return !lastContacted || lastContacted.getTime() < thirtyDaysAgo.getTime();
          }).length
      ),
    prisma.sale.findMany({
      where: { eventDate: { gte: yearStart } },
      select: { eventDate: true, totalCost: true },
    }),
  ]);

  // Simple revenue-by-month widget for the current year, no charting library needed.
  const monthlyRevenue = Array.from({ length: 12 }, () => 0);
  for (const s of salesThisYear) {
    if (!s.eventDate) continue;
    const m = new Date(s.eventDate).getUTCMonth(); // eventDate is stored as UTC midnight
    monthlyRevenue[m] += Number(s.totalCost || 0);
  }
  const maxRevenue = Math.max(...monthlyRevenue, 1);
  const totalRevenueThisYear = monthlyRevenue.reduce((a, b) => a + b, 0);
  const monthLabels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  const cards = [
    { label: "Total contacts", value: totalContacts, href: "/contacts", icon: Users, color: "text-crust" },
    {
      label: "Current customers",
      value: currentCustomers,
      href: "/contacts?contactType=Current+Customer",
      icon: UserCheck,
      color: "text-basil",
    },
    {
      label: "Potential customers",
      value: potentialCustomers,
      href: "/contacts?contactType=Potential+Customer",
      icon: UserPlus,
      color: "text-neutral-500",
    },
    { label: "Open leads", value: openLeads, href: "/leads", icon: Target, color: "text-crust" },
    {
      label: "Stale leads",
      value: staleLeads,
      href: "/reports?tab=stale",
      icon: Clock,
      color: "text-sauce",
    },
    {
      label: "Upcoming sales (60 days)",
      value: upcomingSales,
      href: "/reports?tab=events",
      icon: CalendarClock,
      color: "text-crust",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-800">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-xl border border-neutral-200 p-4 hover:border-crust/40 hover:shadow-sm transition-all"
          >
            <c.icon size={18} className={c.color} />
            <div className="text-2xl font-bold text-neutral-800 mt-2">{c.value}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-basil" />
            <h2 className="font-semibold text-neutral-800">Revenue by month ({now.getFullYear()})</h2>
          </div>
          <span className="text-sm text-neutral-500">${totalRevenueThisYear.toLocaleString()} total</span>
        </div>
        <div className="flex items-end gap-2 h-32">
          {monthlyRevenue.map((rev, i) => (
            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
              <div
                className="w-full bg-crust/80 rounded-t"
                style={{ height: `${Math.max((rev / maxRevenue) * 100, rev > 0 ? 4 : 0)}%` }}
                title={`$${rev.toLocaleString()}`}
              />
              <span className="text-[10px] text-neutral-400">{monthLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
