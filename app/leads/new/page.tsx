"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContactPicker from "@/components/ContactPicker";

const STAGES = ["Info Sent", "Follow-up", "Deposit Paid", "Contract Sent", "Negotiation", "Requested More Info"];
const PRIORITIES = ["High", "Med", "Low"];
const SOURCES = ["Referral", "Advertising", "Text", "Email", "Social", "Other"];

export default function NewLeadPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);
  const [stage, setStage] = useState("Info Sent");
  const [value, setValue] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [priority, setPriority] = useState("Med");
  const [source, setSource] = useState("Referral");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) {
      setError("Pick the contact this lead belongs to.");
      return;
    }
    setSaving(true);
    setError("");

    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contactId,
        stage,
        value: value ? Number(value) : null,
        eventDate: eventDate || null,
        priority,
        source,
        description: description || null,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong");
      return;
    }

    router.push("/leads");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-800 mb-4">New lead</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4 max-w-lg">
        {error && <p className="text-sauce text-sm">{error}</p>}

        <label className="block">
          <span className="block text-sm font-medium mb-1">Lead name / title *</span>
          <input
            required
            className="input"
            placeholder='e.g. "Wedding (12/12/26)"'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">Contact *</span>
          <div>
            <ContactPicker
              currentName={contactName}
              onSelect={(c) => {
                setContactId(c.id);
                setContactName(c.name);
              }}
            />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Stage</span>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Priority</span>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Estimated value ($)</span>
            <input
              type="number"
              className="input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Target event date</span>
            <input
              type="date"
              className="input"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Source</span>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium mb-1">Notes</span>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="flex items-center gap-3">
          <button
            disabled={saving}
            className="bg-crust text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create lead"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border border-neutral-200 text-neutral-600 px-4 py-2 rounded-lg font-semibold"
          >
            Cancel
          </button>
        </div>

        <style jsx global>{`
          .input {
            border: 1px solid #d4d4d4;
            border-radius: 0.5rem;
            padding: 0.5rem 0.75rem;
            width: 100%;
          }
        `}</style>
      </form>
    </div>
  );
}
