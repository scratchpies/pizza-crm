import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import type { Prisma } from "@prisma/client";

// Splits "Erin Nikilinski" -> { first: "Erin", last: "Nikilinski" }.
// Not perfect for multi-word last names, but matches what Omnisend expects
// (separate First name / Last name columns).
function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.join(" ");
  return { first, last };
}

// Cleans a phone number toward E.164-ish so Omnisend doesn't choke on it.
// Leaves it alone if we can't confidently tell the country code.
function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`; // assume US
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";
  const contactType = searchParams.get("contactType");
  const tag = searchParams.get("tag");
  const requireEmail = searchParams.get("requireEmail") !== "0"; // default: only rows with an email

  const where: Prisma.ContactWhereInput = { doNotEmail: false };
  if (contactType) where.contactType = contactType;
  if (tag) where.tag = tag;
  if (requireEmail) where.email = { not: null };

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
  });

  if (format === "json") {
    return NextResponse.json({ count: contacts.length, sample: contacts.slice(0, 5) });
  }

  const rows = contacts.map((c) => {
    const { first, last } = splitName(c.name);
    return {
      Email: c.email || "",
      "First Name": first,
      "Last Name": last,
      "Phone Number": cleanPhone(c.phone),
      City: c.city || "",
      Country: c.country || "US",
      "Postal Code": c.zip || "",
      Tag: c.tag || "",
      "Contact Type": c.contactType,
    };
  });

  const csv = Papa.unparse(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scratch-pies-omnisend-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
