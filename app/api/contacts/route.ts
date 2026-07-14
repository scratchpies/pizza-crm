import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// GET /api/contacts?q=&contactType=&tag=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const contactType = searchParams.get("contactType");
  const tag = searchParams.get("tag");

  const where: Prisma.ContactWhereInput = {};

  if (contactType) where.contactType = contactType;
  if (tag) where.tag = tag;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
    take: 1000,
    include: {
      _count: { select: { sales: true, opportunities: true } },
      sales: { orderBy: { eventDate: "desc" }, take: 1, select: { eventDate: true } },
    },
  });

  return NextResponse.json({ contacts });
}

// POST /api/contacts - create a new contact
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        name: body.name,
        tag: body.tag || null,
        contactType: body.contactType || "Potential Customer",
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        city: body.city || null,
        zip: body.zip || null,
        country: body.country || "US",
        social: body.social || null,
        assignee: body.assignee || null,
        description: body.description || null,
        doNotEmail: body.doNotEmail ?? false,
      },
    });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
