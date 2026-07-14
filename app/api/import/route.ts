import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

// Accepts a CSV upload with headers matching (case-insensitively):
// Name, Email, Phone, ContactType, Tag, City, Zip, Country, Assignee, Description
// Existing contacts are matched by email (if present) and updated; everyone else is created new.
// This is for ADDING new contacts later, not the one-time historical import
// (that's handled by prisma/seed.js from the original spreadsheet).
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length) {
    return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
  }

  const rows = parsed.data as Record<string, string>[];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const get = (row: Record<string, string>, key: string) => {
    const foundKey = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
    return foundKey ? row[foundKey]?.trim() || null : null;
  };

  for (const row of rows) {
    const name = get(row, "Name");
    if (!name) {
      skipped++;
      continue;
    }
    const email = get(row, "Email");

    const data = {
      name,
      email,
      phone: get(row, "Phone"),
      contactType: get(row, "ContactType") || "Potential Customer",
      tag: get(row, "Tag"),
      city: get(row, "City"),
      zip: get(row, "Zip"),
      country: get(row, "Country") || "US",
      assignee: get(row, "Assignee"),
      description: get(row, "Description"),
    };

    const existing = email ? await prisma.contact.findFirst({ where: { email } }) : null;

    if (existing) {
      await prisma.contact.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.contact.create({ data });
      created++;
    }
  }

  return NextResponse.json({ created, updated, skipped, total: rows.length });
}
