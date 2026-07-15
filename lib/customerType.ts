import { prisma } from "@/lib/prisma";

// Most contacts start out as "Potential Customer" (the default for new
// leads) and it's easy to forget to flip them over by hand once they
// actually book. So any time a sale is linked to a contact, promote that
// contact to "Current Customer" automatically -- having a booked sale is
// the clearest possible signal that they're an actual customer now.
export async function promoteToCurrentCustomer(contactId: string | null | undefined) {
  if (!contactId) return;
  await prisma.contact.update({
    where: { id: contactId },
    data: { contactType: "Current Customer" },
  });
}
