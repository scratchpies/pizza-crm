import { prisma } from "@/lib/prisma";
import SaleForm from "@/components/SaleForm";
import { toDateInputValue } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Supports /sales/new?fromOpportunity=<id> to pre-fill a sale from a won lead,
// using whatever we already know from both the Leads tab (event date,
// estimated value, notes) and the linked Customer record (city, assignee).
export default async function NewSalePage({
  searchParams,
}: {
  searchParams: { fromOpportunity?: string };
}) {
  let initial = {};

  if (searchParams.fromOpportunity) {
    const opp = await prisma.opportunity.findUnique({
      where: { id: searchParams.fromOpportunity },
      include: {
        contact: { select: { id: true, name: true, city: true, assignee: true } },
      },
    });
    if (opp) {
      initial = {
        opportunityId: opp.id,
        opportunityName: opp.name,
        contactId: opp.contactId,
        contactName: opp.contact?.name || null,
        clientNameRaw: opp.contact?.name || opp.customerNameRaw || "",
        eventDate: toDateInputValue(opp.eventDate),
        totalCost: opp.value?.toString() || "",
        location: opp.contact?.city || "",
        assignedStaff: opp.contact?.assignee || "",
        notes: opp.description || "",
      };
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">New sale</h1>
      <SaleForm initial={initial} />
    </div>
  );
}
