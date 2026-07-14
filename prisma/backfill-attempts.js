// One-time backfill: the original spreadsheet tracked every outreach touch
// as a bracketed list at the end of the Description field, e.g.
//   "6/14, 75 pple, 1st bday, Colts Neck [5/15,5/24,6/3]"
// meaning 3 separate contact attempts on 5/15, 5/24, and 6/3.
// This reads prisma/seed-data/outreach-attempts.json (pre-parsed from the
// real sheet) and logs a ContactAttempt for each date found.
//
// Safe to re-run: it checks for an existing attempt on the same day for the
// same lead before creating a new one, so running it twice won't double up.
//
// Usage: npm run db:backfill-attempts

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data", name), "utf-8"));
}

async function main() {
  const entries = readJson("outreach-attempts.json");

  let leadsTouched = 0;
  let attemptsCreated = 0;
  let attemptsSkippedExisting = 0;
  let leadsNotFound = 0;

  for (const entry of entries) {
    const opportunity = await prisma.opportunity.findUnique({ where: { sourceId: entry.sourceId } });
    if (!opportunity) {
      leadsNotFound++;
      console.warn(`  No opportunity found for sourceId ${entry.sourceId}, skipping its outreach dates`);
      continue;
    }

    const existing = await prisma.contactAttempt.findMany({
      where: { opportunityId: opportunity.id },
      select: { contactedAt: true },
    });
    const existingDays = new Set(existing.map((a) => a.contactedAt.toISOString().slice(0, 10)));

    let createdForThisLead = 0;
    for (const dateStr of entry.dates) {
      if (existingDays.has(dateStr)) {
        attemptsSkippedExisting++;
        continue;
      }
      await prisma.contactAttempt.create({
        data: {
          opportunityId: opportunity.id,
          contactedAt: new Date(`${dateStr}T00:00:00.000Z`),
          note: "Imported from spreadsheet outreach log",
        },
      });
      attemptsCreated++;
      createdForThisLead++;
    }
    if (createdForThisLead > 0) leadsTouched++;
  }

  console.log("Done.");
  console.log(`  Leads touched: ${leadsTouched}`);
  console.log(`  Attempts created: ${attemptsCreated}`);
  console.log(`  Attempts already present (skipped): ${attemptsSkippedExisting}`);
  console.log(`  Leads referenced but not found in DB: ${leadsNotFound}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
