import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const attempts = await prisma.contactAttempt.findMany({
    where: { opportunityId: params.id },
    orderBy: { contactedAt: "desc" },
  });
  return NextResponse.json({ attempts });
}

// POST /api/opportunities/[id]/attempts - log a new outreach touch.
// Body is optional: { contactedAt?, method?, note? }. Defaults to "right now".
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));

  const attempt = await prisma.contactAttempt.create({
    data: {
      opportunityId: params.id,
      contactedAt: body.contactedAt ? new Date(body.contactedAt) : new Date(),
      method: body.method || null,
      note: body.note || null,
    },
  });

  return NextResponse.json({ attempt }, { status: 201 });
}
