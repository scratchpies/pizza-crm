import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promoteToCurrentCustomer } from "@/lib/customerType";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming"); // "1" to only show future sales

  const where: Prisma.SaleWhereInput = {};
  if (status) where.eventStatus = status;
  if (upcoming === "1") {
    // Anchor on UTC midnight of today, not the exact request timestamp --
    // eventDate is stored as UTC midnight, so comparing against the live
    // clock would drop today's events once UTC rolls past midnight.
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    where.eventDate = { gte: todayUTC };
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { eventDate: "desc" },
    include: {
      contact: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
    },
    take: 1000,
  });

  return NextResponse.json({ sales });
}

// POST /api/sales - create a new sale, optionally pre-filled from a won opportunity
// via body.opportunityId (see app/sales/new/page.tsx).
export async function POST(req: NextRequest) {
  const body = await req.json();

  const sale = await prisma.sale.create({
    data: {
      opportunityId: body.opportunityId || null,
      contactId: body.contactId || null,
      clientNameRaw: body.clientNameRaw || null,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      location: body.location || null,
      guests: body.guests ?? null,
      numPizzas: body.numPizzas ?? null,
      numDoughs: body.numDoughs ?? null,
      pizza1: body.pizza1 || null,
      pizza2: body.pizza2 || null,
      pizza3: body.pizza3 || null,
      pizza4: body.pizza4 || null,
      additionalPizza: body.additionalPizza || null,
      additionalItems: body.additionalItems || null,
      specialRequests: body.specialRequests || null,
      totalCost: body.totalCost ?? null,
      depositPaid: body.depositPaid ?? null,
      tip: body.tip ?? null,
      depositMethod: body.depositMethod || null,
      finalPaymentMethod: body.finalPaymentMethod || null,
      paidInFull: body.paidInFull ?? null,
      assignedStaff: body.assignedStaff || null,
      eventStatus: body.eventStatus || "Booked",
      ovensUsed: body.ovensUsed ?? null,
      postEventFeedback: body.postEventFeedback || null,
      notes: body.notes || null,
    },
  });

  await promoteToCurrentCustomer(sale.contactId);

  return NextResponse.json({ sale }, { status: 201 });
}
