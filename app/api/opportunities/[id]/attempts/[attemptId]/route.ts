import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; attemptId: string } }
) {
  await prisma.contactAttempt.delete({ where: { id: params.attemptId } });
  return NextResponse.json({ ok: true });
}
