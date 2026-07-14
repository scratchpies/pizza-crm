// One-time import of the real Scratch Pies data (Customers / Opportunities /
// Events_Sales tabs from the spreadsheet), pre-parsed into JSON files in
// ./seed-data by a one-off script. Safe to re-run: it upserts on sourceId,
// so running it again just refreshes the same rows instead of duplicating.
//
// Usage: npm run db:seed   (after `npm run db:push` has created the tables)

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function readJson(name) {
  const p = path.join(__dirname, "seed-data", name);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function main() {
  const contacts = readJson("contacts.json");
  const opportunities = readJson("opportunities.json");
  const sales = readJson("events.json"); // filename kept from the original "Events_Sales" tab export

  console.log(`Importing ${contacts.length} contacts...`);
  const nameKeyToId = new Map();

  for (const c of contacts) {
    let name = c.name;
    if (!name || !name.trim()) {
      name = c.email || c.phone || `Unnamed contact (${c.sourceId})`;
      console.warn(`  ${c.sourceId} had no name in the sheet, using "${name}" instead`);
    }

    const contact = await prisma.contact.upsert({
      where: { sourceId: c.sourceId },
      update: {
        name,
        tag: c.tag,
        contactType: c.contactType || "Potential Customer",
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        zip: c.zip,
        country: c.country || "US",
        social: c.social,
        assignee: c.assignee,
        description: c.description,
      },
      create: {
        sourceId: c.sourceId,
        name,
        tag: c.tag,
        contactType: c.contactType || "Potential Customer",
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        zip: c.zip,
        country: c.country || "US",
        social: c.social,
        assignee: c.assignee,
        description: c.description,
      },
    });
    if (c.nameKey && !nameKeyToId.has(c.nameKey)) {
      nameKeyToId.set(c.nameKey, contact.id);
    }
  }

  console.log(`Importing ${opportunities.length} opportunities/leads...`);
  let oppMatched = 0;
  // Rows that are completely empty except for the auto-numbered ID are blank
  // template rows the sheet reserved for future leads that were never filled
  // in -- not real data. Skip them entirely instead of importing fake
  // "Untitled lead" placeholders, and clean up any that got imported by an
  // earlier run of this script.
  const isBlankPlaceholder = (o) =>
    !(o.name && o.name.trim()) &&
    !(o.customerNameRaw && o.customerNameRaw.trim()) &&
    !o.stage &&
    !o.status &&
    o.value == null;

  const placeholderSourceIds = opportunities.filter(isBlankPlaceholder).map((o) => o.sourceId);
  const realOpportunities = opportunities.filter((o) => !isBlankPlaceholder(o));

  if (placeholderSourceIds.length) {
    const { count } = await prisma.opportunity.deleteMany({
      where: { sourceId: { in: placeholderSourceIds } },
    });
    console.log(
      `  Skipping ${placeholderSourceIds.length} blank placeholder rows from the sheet (${count} removed if previously imported)`
    );
  }

  // keep the created/updated opportunity rows around so we can auto-link sales below
  const opportunityRecords = [];

  for (const o of realOpportunities) {
    const contactId = o.customerNameKey ? nameKeyToId.get(o.customerNameKey) : undefined;
    if (contactId) oppMatched++;

    const oppName = o.name && o.name.trim() ? o.name : o.customerNameRaw || `Lead ${o.sourceId}`;

    const opportunity = await prisma.opportunity.upsert({
      where: { sourceId: o.sourceId },
      update: {
        name: oppName,
        tag: o.tag,
        contactId: contactId || null,
        customerNameRaw: o.customerNameRaw,
        stage: o.stage,
        value: o.value,
        eventDate: o.eventDate ? new Date(o.eventDate) : null,
        eventDateRaw: o.eventDateRaw,
        winPct: o.winPct,
        status: o.status || "Open",
        lossReason: o.lossReason,
        priority: o.priority,
        source: o.source,
        description: o.description,
      },
      create: {
        sourceId: o.sourceId,
        name: oppName,
        tag: o.tag,
        contactId: contactId || null,
        customerNameRaw: o.customerNameRaw,
        stage: o.stage,
        value: o.value,
        eventDate: o.eventDate ? new Date(o.eventDate) : null,
        eventDateRaw: o.eventDateRaw,
        winPct: o.winPct,
        status: o.status || "Open",
        lossReason: o.lossReason,
        priority: o.priority,
        source: o.source,
        description: o.description,
      },
    });
    opportunityRecords.push({ ...opportunity, contactId: contactId || null });
  }

  console.log(`Importing ${sales.length} sales (booked events)...`);
  let saleMatched = 0;
  const usedOpportunityIds = new Set();

  for (const s of sales) {
    const contactId = s.clientNameKey ? nameKeyToId.get(s.clientNameKey) : undefined;
    if (contactId) saleMatched++;

    // Auto-link this sale to the won opportunity it most likely came from:
    // same contact, status Won or winPct 100%, not already claimed by another sale,
    // preferring the one with the closest event date.
    let opportunityId = null;
    if (contactId) {
      const candidates = opportunityRecords.filter(
        (o) =>
          o.contactId === contactId &&
          !usedOpportunityIds.has(o.id) &&
          (o.status === "Won" || o.winPct === 1)
      );
      if (candidates.length === 1) {
        opportunityId = candidates[0].id;
      } else if (candidates.length > 1) {
        const saleDate = s.eventDate ? new Date(s.eventDate).getTime() : null;
        candidates.sort((a, b) => {
          if (saleDate == null) return 0;
          const aDate = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
          const bDate = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
          return Math.abs(aDate - saleDate) - Math.abs(bDate - saleDate);
        });
        opportunityId = candidates[0].id;
      }
      if (opportunityId) usedOpportunityIds.add(opportunityId);
    }

    await prisma.sale.upsert({
      where: { sourceId: s.sourceId },
      update: {
        eventDate: s.eventDate ? new Date(s.eventDate) : null,
        contactId: contactId || null,
        opportunityId,
        clientNameRaw: s.clientNameRaw,
        location: s.location,
        guests: s.guests != null ? Math.round(s.guests) : null,
        numPizzas: s.numPizzas != null ? Math.round(s.numPizzas) : null,
        numDoughs: s.numDoughs != null ? Math.round(s.numDoughs) : null,
        pizza1: s.pizza1,
        pizza2: s.pizza2,
        pizza3: s.pizza3,
        pizza4: s.pizza4,
        additionalPizza: s.additionalPizza,
        additionalItems: s.additionalItems,
        specialRequests: s.specialRequests,
        totalCost: s.totalCost,
        depositPaid: s.depositPaid,
        tip: s.tip,
        depositMethod: s.depositMethod,
        finalPaymentMethod: s.finalPaymentMethod,
        paidInFull: s.paidInFull,
        assignedStaff: s.assignedStaff,
        eventStatus: s.eventStatus,
        ovensUsed: s.ovensUsed != null ? Math.round(s.ovensUsed) : null,
        postEventFeedback: s.postEventFeedback,
        notes: s.notes,
      },
      create: {
        sourceId: s.sourceId,
        eventDate: s.eventDate ? new Date(s.eventDate) : null,
        contactId: contactId || null,
        opportunityId,
        clientNameRaw: s.clientNameRaw,
        location: s.location,
        guests: s.guests != null ? Math.round(s.guests) : null,
        numPizzas: s.numPizzas != null ? Math.round(s.numPizzas) : null,
        numDoughs: s.numDoughs != null ? Math.round(s.numDoughs) : null,
        pizza1: s.pizza1,
        pizza2: s.pizza2,
        pizza3: s.pizza3,
        pizza4: s.pizza4,
        additionalPizza: s.additionalPizza,
        additionalItems: s.additionalItems,
        specialRequests: s.specialRequests,
        totalCost: s.totalCost,
        depositPaid: s.depositPaid,
        tip: s.tip,
        depositMethod: s.depositMethod,
        finalPaymentMethod: s.finalPaymentMethod,
        paidInFull: s.paidInFull,
        assignedStaff: s.assignedStaff,
        eventStatus: s.eventStatus,
        ovensUsed: s.ovensUsed != null ? Math.round(s.ovensUsed) : null,
        postEventFeedback: s.postEventFeedback,
        notes: s.notes,
      },
    });
  }

  const wonOpportunities = opportunityRecords.filter((o) => o.status === "Won" || o.winPct === 1);

  console.log("Done.");
  console.log(`  Contacts imported: ${contacts.length}`);
  console.log(
    `  Opportunities imported: ${realOpportunities.length} (linked to a contact: ${oppMatched}), ${placeholderSourceIds.length} blank placeholders skipped`
  );
  console.log(`  Sales imported: ${sales.length} (linked to a contact: ${saleMatched})`);
  console.log(
    `  Won opportunities: ${wonOpportunities.length} (auto-linked to a sale: ${usedOpportunityIds.size})`
  );
  console.log(
    `  Won opportunities with no sale yet: ${wonOpportunities.length - usedOpportunityIds.size} -- these show up on the Leads page as "needs a sale".`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
