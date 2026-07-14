import { prisma } from "@/lib/prisma";

// Matches the spreadsheet's own lead ID convention: "YY_N" where YY is the
// two-digit year and N is an incrementing number for that year (e.g. "26_107").
// Finds the highest existing N for the current year and returns the next one.
export async function generateLeadSourceId(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const prefix = `${yy}_`;

  const existing = await prisma.opportunity.findMany({
    where: { sourceId: { startsWith: prefix } },
    select: { sourceId: true },
  });

  let max = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  for (const o of existing) {
    const match = o.sourceId ? o.sourceId.match(pattern) : null;
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }

  return `${prefix}${max + 1}`;
}
