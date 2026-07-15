import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promoteToCurrentCustomer } from "@/lib/customerType";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sale = await prisma.sale.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, name: true, email: true, phone: true } },
      opportunity: { select: { id: true, name: true, value: true, winPct: true, status: true } },
    },
  });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sale });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = { ...body };
  delete data.id;
  delete data.contact;
  delete data.opportunity;
  delete data.createdAt;
  delete data.updatedAt;
  if ("eventDate" in body) data.eventDate = body.eventDate ? new Date(body.eventDate) : null;

  const sale = await prisma.sale.update({ where: { id: params.id }, data });
  await promoteToCurrentCustomer(sale.contactId);
  return NextResponse.json({ sale });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.sale.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
