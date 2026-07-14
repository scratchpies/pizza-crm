import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      opportunities: { orderBy: { createdAt: "desc" } },
      sales: { orderBy: { eventDate: "desc" } },
    },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();

  const data: Record<string, unknown> = { ...body };
  delete data.id;
  delete data.sourceId;
  delete data.createdAt;
  delete data.updatedAt;
  delete data.opportunities;
  delete data.sales;
  delete data._count;

  try {
    const contact = await prisma.contact.update({ where: { id: params.id }, data });
    return NextResponse.json({ contact });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
