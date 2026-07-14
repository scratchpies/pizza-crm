"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ContactFormValues = {
  id?: string;
  name: string;
  tag: string;
  contactType: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  social: string;
  assignee: string;
  description: string;
  doNotEmail: boolean;
};

const emptyValues: ContactFormValues = {
  name: "",
  tag: "",
  contactType: "Potential Customer",
  email: "",
  phone: "",
  address: "",
  city: "",
  zip: "",
  country: "US",
  social: "",
  assignee: "",
  description: "",
  doNotEmail: false,
};

export default function ContactForm({ initial }: { initial?: Partial<ContactFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<ContactFormValues>({ ...emptyValues, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof ContactFormValues>(key: K, val: ContactFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const isEdit = Boolean(values.id);
    const url = isEdit ? `/api/contacts/${values.id}` : "/api/contacts";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong");
      return;
    }

    const data = await res.json();
    router.push(`/contacts/${data.contact.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!values.id) return;
    if (!confirm(`Delete ${values.name}? This can't be undone.`)) return;
    await fetch(`/api/contacts/${values.id}`, { method: "DELETE" });
    router.push("/contacts");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-2xl">
      {error && <p className="text-sauce text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name *">
          <input
            required
            className="input"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Contact type">
          <select
            className="input"
            value={values.contactType}
            onChange={(e) => set("contactType", e.target.value)}
          >
            <option>Potential Customer</option>
            <option>Current Customer</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="input"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input className="input" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Tag">
          <input
            className="input"
            placeholder="Guest, Friend, Repeat..."
            value={values.tag}
            onChange={(e) => set("tag", e.target.value)}
          />
        </Field>
        <Field label="Assignee">
          <input
            className="input"
            value={values.assignee}
            onChange={(e) => set("assignee", e.target.value)}
          />
        </Field>
        <Field label="Address">
          <input className="input" value={values.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="City">
          <input className="input" value={values.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Zip">
          <input className="input" value={values.zip} onChange={(e) => set("zip", e.target.value)} />
        </Field>
        <Field label="Country">
          <input className="input" value={values.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Social">
          <input className="input" value={values.social} onChange={(e) => set("social", e.target.value)} />
        </Field>
      </div>

      <Field label="Notes / description">
        <textarea
          className="input"
          rows={3}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.doNotEmail}
          onChange={(e) => set("doNotEmail", e.target.checked)}
        />
        Do not email (leave unchecked for normal marketing emails)
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          disabled={saving}
          className="bg-crust text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
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
            Delete contact
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
