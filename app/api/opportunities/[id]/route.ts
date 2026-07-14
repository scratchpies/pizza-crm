import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = { ...body };
  delete data.id;
  delete data.contact;
  delete data.createdAt;
  delete data.updatedAt;
  if ("eventDate" in body) data.eventDate = body.eventDate ? new Date(body.eventDate) : null;

  try {
    const opportunity = await prisma.opportunity.update({ where: { id: params.id }, data });
    return NextResponse.json({ opportunity });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.opportunity.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
