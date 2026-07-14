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

  const event = await prisma.event.update({ where: { id: params.id }, data });
  return NextResponse.json({ event });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.event.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
