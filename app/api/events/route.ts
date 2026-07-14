import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const upcoming = searchParams.get("upcoming"); // "1" to only show future events

  const where: Prisma.EventWhereInput = {};
  if (status) where.eventStatus = status;
  if (upcoming === "1") where.eventDate = { gte: new Date() };

  const events = await prisma.event.findMany({
    where,
    orderBy: { eventDate: "desc" },
    include: { contact: { select: { id: true, name: true } } },
    take: 1000,
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const event = await prisma.event.create({
    data: {
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      contactId: body.contactId || null,
      clientNameRaw: body.clientNameRaw || null,
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
      eventStatus: body.eventStatus || null,
      ovensUsed: body.ovensUsed ?? null,
      postEventFeedback: body.postEventFeedback || null,
      notes: body.notes || null,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
