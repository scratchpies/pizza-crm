// One-time cleanup: any contact who already has at least one booked sale on
// record should be marked "Current Customer", regardless of what they're
// currently set to (most were left at the default "Potential Customer" since
// that's easy to forget to flip by hand). Going forward this happens
// automatically whenever a sale is created/linked -- see lib/customerType.ts.
//
// Safe to re-run: contacts already marked "Current Customer" are just left
// alone (they're excluded from the update in the first place).
//
// Usage: npm run db:backfill-current-customers

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.contact.updateMany({
    where: {
      contactType: { not: "Current Customer" },
      sales: { some: {} },
    },
    data: { contactType: "Current Customer" },
  });

  console.log(`Promoted ${result.count} contact(s) to Current Customer.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
