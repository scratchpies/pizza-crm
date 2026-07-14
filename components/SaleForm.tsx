"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContactPicker from "./ContactPicker";

export type SaleFormValues = {
  id?: string;
  contactId: string | null;
  contactName?: string | null;
  opportunityId: string | null;
  opportunityName?: string | null;
  clientNameRaw: string;
  eventDate: string; // yyyy-mm-dd for <input type=date>
  location: string;
  guests: string;
  numPizzas: string;
  numDoughs: string;
  pizza1: string;
  pizza2: string;
  pizza3: string;
  pizza4: string;
  additionalPizza: string;
  additionalItems: string;
  specialRequests: string;
  totalCost: string;
  depositPaid: string;
  tip: string;
  depositMethod: string;
  finalPaymentMethod: string;
  paidInFull: boolean;
  assignedStaff: string;
  eventStatus: string;
  ovensUsed: string;
  postEventFeedback: string;
  notes: string;
};

const empty: SaleFormValues = {
  contactId: null,
  opportunityId: null,
  clientNameRaw: "",
  eventDate: "",
  location: "",
  guests: "",
  numPizzas: "",
  numDoughs: "",
  pizza1: "",
  pizza2: "",
  pizza3: "",
  pizza4: "",
  additionalPizza: "",
  additionalItems: "",
  specialRequests: "",
  totalCost: "",
  depositPaid: "",
  tip: "",
  depositMethod: "",
  finalPaymentMethod: "",
  paidInFull: false,
  assignedStaff: "",
  eventStatus: "Booked",
  ovensUsed: "",
  postEventFeedback: "",
  notes: "",
};

const STATUSES = ["Booked", "Confirmed", "DONE", "Cancelled"];

function num(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export default function SaleForm({ initial }: { initial?: Partial<SaleFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<SaleFormValues>({ ...empty, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof SaleFormValues>(key: K, val: SaleFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      contactId: values.contactId,
      opportunityId: values.opportunityId,
      clientNameRaw: values.clientNameRaw || null,
      eventDate: values.eventDate || null,
      location: values.location || null,
      guests: num(values.guests),
      numPizzas: num(values.numPizzas),
      numDoughs: num(values.numDoughs),
      pizza1: values.pizza1 || null,
      pizza2: values.pizza2 || null,
      pizza3: values.pizza3 || null,
      pizza4: values.pizza4 || null,
      additionalPizza: values.additionalPizza || null,
      additionalItems: values.additionalItems || null,
      specialRequests: values.specialRequests || null,
      totalCost: num(values.totalCost),
      depositPaid: num(values.depositPaid),
      tip: num(values.tip),
      depositMethod: values.depositMethod || null,
      finalPaymentMethod: values.finalPaymentMethod || null,
      paidInFull: values.paidInFull,
      assignedStaff: values.assignedStaff || null,
      eventStatus: values.eventStatus || null,
      ovensUsed: num(values.ovensUsed),
      postEventFeedback: values.postEventFeedback || null,
      notes: values.notes || null,
    };

    const isEdit = Boolean(values.id);
    const res = await fetch(isEdit ? `/api/sales/${values.id}` : "/api/sales", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong");
      return;
    }

    const data = await res.json();
    const sale = data.sale;
    router.push(`/sales/${sale.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!values.id) return;
    if (!confirm("Delete this sale? This can't be undone.")) return;
    await fetch(`/api/sales/${values.id}`, { method: "DELETE" });
    router.push("/sales");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6 max-w-3xl">
      {error && <p className="text-sauce text-sm">{error}</p>}

      <section>
        <h3 className="text-sm font-semibold text-neutral-500 mb-2">WHO & WHEN</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Client name (as booked)">
            <input
              className="input"
              value={values.clientNameRaw}
              onChange={(e) => set("clientNameRaw", e.target.value)}
            />
          </Field>
          <Field label="Linked contact">
            <ContactPicker
              currentName={values.contactName}
              onSelect={(c) => {
                set("contactId", c.id);
                set("contactName", c.name);
              }}
            />
          </Field>
          <Field label="Event date">
            <input
              type="date"
              className="input"
              value={values.eventDate}
              onChange={(e) => set("eventDate", e.target.value)}
            />
          </Field>
          <Field label="Location">
            <input className="input" value={values.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Guests">
            <input
              type="number"
              className="input"
              value={values.guests}
              onChange={(e) => set("guests", e.target.value)}
            />
          </Field>
          <Field label="Status">
            <select className="input" value={values.eventStatus} onChange={(e) => set("eventStatus", e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        {values.opportunityName && (
          <p className="text-xs text-neutral-500 mt-2">Originated from lead: {values.opportunityName}</p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-500 mb-2">PIZZA & QUANTITIES</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="# Pizzas">
            <input
              type="number"
              className="input"
              value={values.numPizzas}
              onChange={(e) => set("numPizzas", e.target.value)}
            />
          </Field>
          <Field label="# Doughs">
            <input
              type="number"
              className="input"
              value={values.numDoughs}
              onChange={(e) => set("numDoughs", e.target.value)}
            />
          </Field>
          <Field label="Pizza 1">
            <input className="input" value={values.pizza1} onChange={(e) => set("pizza1", e.target.value)} />
          </Field>
          <Field label="Pizza 2">
            <input className="input" value={values.pizza2} onChange={(e) => set("pizza2", e.target.value)} />
          </Field>
          <Field label="Pizza 3">
            <input className="input" value={values.pizza3} onChange={(e) => set("pizza3", e.target.value)} />
          </Field>
          <Field label="Pizza 4">
            <input className="input" value={values.pizza4} onChange={(e) => set("pizza4", e.target.value)} />
          </Field>
          <Field label="Additional pizza">
            <input
              className="input"
              value={values.additionalPizza}
              onChange={(e) => set("additionalPizza", e.target.value)}
            />
          </Field>
          <Field label="Additional items">
            <input
              className="input"
              value={values.additionalItems}
              onChange={(e) => set("additionalItems", e.target.value)}
            />
          </Field>
          <Field label="Ovens used">
            <input
              type="number"
              className="input"
              value={values.ovensUsed}
              onChange={(e) => set("ovensUsed", e.target.value)}
            />
          </Field>
          <Field label="Assigned staff">
            <input
              className="input"
              value={values.assignedStaff}
              onChange={(e) => set("assignedStaff", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Special requests">
          <textarea
            className="input mt-2"
            rows={2}
            value={values.specialRequests}
            onChange={(e) => set("specialRequests", e.target.value)}
          />
        </Field>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-500 mb-2">PAYMENT</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Total cost ($)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={values.totalCost}
              onChange={(e) => set("totalCost", e.target.value)}
            />
          </Field>
          <Field label="Deposit paid ($)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={values.depositPaid}
              onChange={(e) => set("depositPaid", e.target.value)}
            />
          </Field>
          <Field label="Deposit method">
            <input
              className="input"
              value={values.depositMethod}
              onChange={(e) => set("depositMethod", e.target.value)}
            />
          </Field>
          <Field label="Final payment method">
            <input
              className="input"
              value={values.finalPaymentMethod}
              onChange={(e) => set("finalPaymentMethod", e.target.value)}
            />
          </Field>
          <Field label="Tip ($)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={values.tip}
              onChange={(e) => set("tip", e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input
            type="checkbox"
            checked={values.paidInFull}
            onChange={(e) => set("paidInFull", e.target.checked)}
          />
          Paid in full
        </label>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-neutral-500 mb-2">NOTES & FEEDBACK</h3>
        <Field label="Post-event feedback">
          <textarea
            className="input"
            rows={2}
            value={values.postEventFeedback}
            onChange={(e) => set("postEventFeedback", e.target.value)}
          />
        </Field>
        <Field label="Internal notes">
          <textarea className="input mt-2" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t">
        <button
          disabled={saving}
          className="bg-crust text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save sale"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-neutral-200 text-neutral-600 px-4 py-2 rounded font-semibold"
        >
          Cancel
        </button>
        {values.id && (
          <button type="button" onClick={handleDelete} className="text-sauce text-sm">
            Delete sale
          </button>
        )}
      </div>

      <style jsx global>{`
        .input {
          border: 1px solid #d4d4d4;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          width: 100%;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
