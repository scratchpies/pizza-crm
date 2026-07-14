import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import SaleForm from "@/components/SaleForm";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const sale = await prisma.sale.findUnique({
    where: { id: params.id },
    include: {
      contact: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true } },
    },
  });

  if (!sale) return notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales" className="text-sm text-crust hover:underline">
          ← Back to sales
        </Link>
        <h1 className="text-2xl font-bold mt-1">
          {sale.contact?.name || sale.clientNameRaw || "Sale"}
        </h1>
      </div>

      <SaleForm
        initial={{
          id: sale.id,
          contactId: sale.contactId,
          contactName: sale.contact?.name || null,
          opportunityId: sale.opportunityId,
          opportunityName: sale.opportunity?.name || null,
          clientNameRaw: sale.clientNameRaw || "",
          eventDate: toDateInput(sale.eventDate),
          location: sale.location || "",
          guests: sale.guests?.toString() || "",
          numPizzas: sale.numPizzas?.toString() || "",
          numDoughs: sale.numDoughs?.toString() || "",
          pizza1: sale.pizza1 || "",
          pizza2: sale.pizza2 || "",
          pizza3: sale.pizza3 || "",
          pizza4: sale.pizza4 || "",
          additionalPizza: sale.additionalPizza || "",
          additionalItems: sale.additionalItems || "",
          specialRequests: sale.specialRequests || "",
          totalCost: sale.totalCost?.toString() || "",
          depositPaid: sale.depositPaid?.toString() || "",
          tip: sale.tip?.toString() || "",
          depositMethod: sale.depositMethod || "",
          finalPaymentMethod: sale.finalPaymentMethod || "",
          paidInFull: sale.paidInFull || false,
          assignedStaff: sale.assignedStaff || "",
          eventStatus: sale.eventStatus || "Booked",
          ovensUsed: sale.ovensUsed?.toString() || "",
          postEventFeedback: sale.postEventFeedback || "",
          notes: sale.notes || "",
        }}
      />
    </div>
  );
}
