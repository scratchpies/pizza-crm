import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      opportunities: { orderBy: { createdAt: "desc" } },
      sales: { orderBy: { eventDate: "desc" } },
    },
  });

  if (!contact) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-crust hover:underline">
          ← Back to contacts
        </Link>
        <h1 className="text-2xl font-bold mt-1 text-neutral-800">{contact.name}</h1>
      </div>

      <ContactForm
        initial={{
          id: contact.id,
          name: contact.name,
          tag: contact.tag || "",
          contactType: contact.contactType,
          email: contact.email || "",
          phone: contact.phone || "",
          address: contact.address || "",
          city: contact.city || "",
          zip: contact.zip || "",
          country: contact.country || "US",
          social: contact.social || "",
          assignee: contact.assignee || "",
          description: contact.description || "",
          doNotEmail: contact.doNotEmail,
        }}
      />

      <div>
        <h2 className="text-lg font-semibold mb-2 text-neutral-800">
          Leads / opportunities ({contact.opportunities.length})
        </h2>
        {contact.opportunities.length === 0 ? (
          <p className="text-sm text-neutral-500">None on file.</p>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {contact.opportunities.map((o) => (
              <Link
                key={o.id}
                href={`/leads?highlight=${o.id}`}
                className="flex justify-between gap-4 p-3 text-sm hover:bg-neutral-50 transition-colors"
              >
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-neutral-500">
                    {o.stage} · {o.status}
                    {o.eventDate ? ` · ${formatDate(o.eventDate)}` : ""}
                  </div>
                </div>
                {o.value != null && <div className="font-medium">${Number(o.value).toLocaleString()}</div>}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2 text-neutral-800">Sales history ({contact.sales.length})</h2>
        {contact.sales.length === 0 ? (
          <p className="text-sm text-neutral-500">None on file.</p>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
            {contact.sales.map((s) => {
              const pizzas = [s.pizza1, s.pizza2, s.pizza3, s.pizza4].filter(Boolean).join(", ");
              const balance = (Number(s.totalCost) || 0) - (Number(s.depositPaid) || 0);
              return (
                <Link
                  key={s.id}
                  href={`/sales/${s.id}`}
                  className="block p-3 text-sm hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex justify-between gap-4">
                    <div className="font-medium">
                      {s.eventDate ? formatDate(s.eventDate) : "No date"} · {s.location || ""}
                    </div>
                    {s.totalCost != null && (
                      <div className="font-medium">${Number(s.totalCost).toLocaleString()}</div>
                    )}
                  </div>
                  <div className="text-neutral-500 mt-0.5">
                    {s.guests ? `${s.guests} guests · ` : ""}
                    {s.eventStatus || ""}
                    {s.paidInFull ? " · Paid in full" : balance > 0 ? ` · $${balance.toLocaleString()} due` : ""}
                  </div>
                  {pizzas && <div className="text-neutral-400 mt-0.5">{pizzas}</div>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
