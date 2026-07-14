import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/opportunities/date-conflicts?date=YYYY-MM-DD&excludeOpportunityId=xxx
// Checks whether another lead or booked sale already exists on that same
// calendar day, so the UI can warn about a potential double-booking before
// saving a changed event date.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const excludeOpportunityId = searchParams.get("excludeOpportunityId") || undefined;

  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  // Store dates as midnight UTC for that calendar day -- match exactly.
  const day = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const [leads, sales] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        eventDate: day,
        id: excludeOpportunityId ? { not: excludeOpportunityId } : undefined,
        status: { notIn: ["Lost", "Abandoned"] },
      },
      select: { id: true, name: true, contact: { select: { name: true } } },
    }),
    prisma.sale.findMany({
      where: { eventDate: day },
      select: { id: true, clientNameRaw: true, contact: { select: { name: true } } },
    }),
  ]);

  const conflicts = [
    ...leads.map((l) => ({ type: "lead" as const, id: l.id, label: `${l.name} (${l.contact?.name || "lead"})` })),
    ...sales.map((s) => ({
      type: "sale" as const,
      id: s.id,
      label: s.contact?.name || s.clientNameRaw || "booked sale",
    })),
  ];

  return NextResponse.json({ conflicts });
}
