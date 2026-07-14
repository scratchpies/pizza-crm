import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLeadSourceId } from "@/lib/leadId";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // comma-separated list, e.g. "Open,Negotiation"
  const stage = searchParams.get("stage");
  const needsSale = searchParams.get("needsSale"); // "1" = won (100%) but no linked sale yet

  const where: Prisma.OpportunityWhereInput = {};
  if (status) {
    const statuses = status.split(",").filter(Boolean);
    if (statuses.length) where.status = { in: statuses };
  }
  if (stage) where.stage = stage;
  if (needsSale === "1") {
    where.OR = [{ status: "Won" }, { winPct: 1 }];
    where.sales = { none: {} };
  }

  const opportunities = await prisma.opportunity.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      contact: { select: { id: true, name: true, email: true, phone: true } },
      sales: { select: { id: true } },
      attempts: { orderBy: { contactedAt: "desc" }, take: 1 },
      _count: { select: { attempts: true } },
    },
    take: 1000,
  });

  return NextResponse.json({ opportunities });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.contactId) {
    return NextResponse.json({ error: "A lead must be linked to a contact" }, { status: 400 });
  }

  const sourceId = await generateLeadSourceId();

  const opportunity = await prisma.opportunity.create({
    data: {
      sourceId,
      name: body.name,
      tag: body.tag || null,
      contactId: body.contactId,
      customerNameRaw: body.customerNameRaw || null,
      stage: body.stage || "Info Sent",
      value: body.value ?? null,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      winPct: body.winPct ?? 0.55, // default confidence for new leads: 55%
      status: body.status || "Open",
      lossReason: body.lossReason || null,
      priority: body.priority || null,
      source: body.source || null,
      description: body.description || null,
    },
  });

  return NextResponse.json({ opportunity }, { status: 201 });
}
