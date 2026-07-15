"use client";

import { Fragment, useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, AlertTriangle, ChevronDown, ArrowUpDown, Pencil, CheckCircle2 } from "lucide-react";
import ContactPicker from "@/components/ContactPicker";
import { formatDate, toDateInputValue, todayLocalDateStr } from "@/lib/dates";

type Attempt = { id: string; contactedAt: string; method: string | null; note: string | null };

type Opportunity = {
  id: string;
  name: string;
  stage: string | null;
  status: string;
  value: number | null;
  eventDate: string | null;
  priority: string | null;
  winPct: number | null;
  description: string | null;
  lossReason: string | null;
  source: string | null;
  contact: { id: string; name: string } | null;
  customerNameRaw: string | null;
  sales: { id: string }[];
  attempts: Attempt[];
  _count: { attempts: number };
};

const STAGES = ["Info Sent", "Follow-up", "Deposit Paid", "Contract Sent", "Negotiation", "Requested More Info"];
const STATUSES = ["Open", "Negotiation", "Won", "Lost", "Abandoned"];
const METHODS = ["Email", "Call", "Text", "Social", "Other"];
const LOSS_REASONS = ["Competitor", "Features", "Price", "Conflict Date", "None"];

// Color-codes how long it's been since the last outreach touch, so stale
// leads jump out visually without having to read a date.
function staleness(days: number | null) {
  if (days == null) return { bg: "bg-neutral-100", text: "text-neutral-500", label: "Never contacted" };
  if (days <= 3) return { bg: "bg-basil/15", text: "text-basil", label: `${days}d ago` };
  if (days <= 7) return { bg: "bg-yellow-100", text: "text-yellow-700", label: `${days}d ago` };
  if (days <= 14) return { bg: "bg-orange-100", text: "text-orange-700", label: `${days}d ago` };
  return { bg: "bg-sauce/15", text: "text-sauce", label: `${days}d ago` };
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// Red (0%) -> yellow (50%) -> green (100%) gradient for the confidence column.
function confidenceColor(pct: number) {
  const hue = (pct / 100) * 120; // 0 = red, 120 = green
  return {
    bg: `hsl(${hue}, 85%, 92%)`,
    text: `hsl(${hue}, 70%, 32%)`,
    accent: `hsl(${hue}, 70%, 45%)`,
  };
}

export default function LeadsClient() {
  const router = useRouter();
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(["Open", "Negotiation"]);
  const [needsSale, setNeedsSale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedAttempts, setExpandedAttempts] = useState<Attempt[]>([]);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter.length) params.set("status", statusFilter.join(","));
    if (needsSale) params.set("needsSale", "1");
    const res = await fetch(`/api/opportunities?${params.toString()}`);
    const data = await res.json();
    setLeads(data.opportunities || []);
    setLoading(false);
  }, [statusFilter, needsSale]);

  useEffect(() => {
    load();
  }, [load]);

  // Sort by event date, nulls always last regardless of direction.
  const sortedLeads = useMemo(() => {
    const withDate = leads.filter((l) => l.eventDate);
    const withoutDate = leads.filter((l) => !l.eventDate);
    withDate.sort((a, b) => {
      const diff = new Date(a.eventDate as string).getTime() - new Date(b.eventDate as string).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
    return [...withDate, ...withoutDate];
  }, [leads, sortDir]);

  async function updateField(id: string, field: string, value: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  // Won -> confidence jumps to 100%. Lost/Abandoned -> confidence drops to 0%.
  // Any other status leaves confidence alone.
  async function updateStatus(id: string, newStatus: string) {
    const winPct = newStatus === "Won" ? 1 : newStatus === "Lost" || newStatus === "Abandoned" ? 0 : undefined;
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus, ...(winPct != null ? { winPct } : {}) } : l))
    );
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...(winPct != null ? { winPct } : {}) }),
    });
    // Marking a lead Lost? Pop the row open right away so the Loss Reason
    // field is right there instead of making them go hunting for it.
    if (newStatus === "Lost") toggleExpand(id, true);
    // Marking a lead Won? Confidence is already saved at 100% above -- jump
    // straight into creating the sale, pre-filled from this lead and its contact.
    if (newStatus === "Won") router.push(`/sales/new?fromOpportunity=${id}`);
  }

  async function updateConfidence(id: string, pct: number) {
    const winPct = pct / 100;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, winPct } : l)));
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winPct }),
    });
  }

  async function updateValue(id: string, value: number | null) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, value } : l)));
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
  }

  async function updateEventDate(id: string, dateStr: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, eventDate: dateStr ? `${dateStr}T00:00:00.000Z` : null } : l)));
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventDate: dateStr || null }),
    });
  }

  async function linkContact(id: string, contactId: string, name: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, contact: { id: contactId, name } } : l)));
    await fetch(`/api/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
  }

  async function logContact(id: string, method?: string, note?: string) {
    // Send today's date explicitly (as the browser sees it) rather than letting
    // the server default to `new Date()` -- avoids a day-boundary mismatch
    // between the user's timezone and the server's.
    const res = await fetch(`/api/opportunities/${id}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, note, contactedAt: todayLocalDateStr() }),
    });
    const data = await res.json();
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, attempts: [data.attempt, ...l.attempts], _count: { attempts: l._count.attempts + 1 } }
          : l
      )
    );
    if (expanded === id) toggleExpand(id, true);
  }

  async function toggleExpand(id: string, forceOpen = false) {
    if (expanded === id && !forceOpen) {
      setExpanded(null);
      return;
    }
    const res = await fetch(`/api/opportunities/${id}/attempts`);
    const data = await res.json();
    setExpandedAttempts(data.attempts || []);
    setExpanded(id);
  }

  async function deleteAttempt(oppId: string, attemptId: string) {
    await fetch(`/api/opportunities/${oppId}/attempts/${attemptId}`, { method: "DELETE" });
    setExpandedAttempts((prev) => prev.filter((a) => a.id !== attemptId));
    setLeads((prev) =>
      prev.map((l) => (l.id === oppId ? { ...l, _count: { attempts: Math.max(0, l._count.attempts - 1) } } : l))
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-800">Leads / opportunities</h1>
        <Link
          href="/leads/new"
          className="flex items-center gap-1.5 bg-crust text-white px-4 py-2 rounded-lg font-semibold text-sm"
        >
          <Plus size={16} />
          New lead
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <MultiSelect options={STATUSES} selected={statusFilter} onChange={setStatusFilter} label="Status" />
        <label className="flex items-center gap-2 text-sm border border-neutral-200 rounded-lg px-3 py-2">
          <input type="checkbox" checked={needsSale} onChange={(e) => setNeedsSale(e.target.checked)} />
          Won, needs a sale created
        </label>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-neutral-100 bg-neutral-50/50 text-neutral-500">
              <th className="p-3 font-medium">Lead</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Stage</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Confidence</th>
              <th className="p-3 font-medium">Value</th>
              <th className="p-3 font-medium">
                <button
                  className="flex items-center gap-1 hover:text-neutral-700"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  Event date
                  <ArrowUpDown size={13} />
                </button>
              </th>
              <th className="p-3 font-medium">Last contacted</th>
              <th className="p-3 font-medium">Priority</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={10}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && sortedLeads.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={10}>
                  No leads found.
                </td>
              </tr>
            )}
            {sortedLeads.map((l) => {
              const lastContacted = l.attempts[0]?.contactedAt || null;
              const days = daysAgo(lastContacted);
              const badge = staleness(days);
              const isWon = l.status === "Won" || l.sales.length > 0;
              const needsSaleFlag = (l.status === "Won") && l.sales.length === 0;
              const manyTouchesNoProgress =
                l._count.attempts >= 4 && ["Open", "Negotiation", "Follow-up"].includes(l.status);

              const stop = (e: React.MouseEvent | React.ChangeEvent) => e.stopPropagation();

              return (
                <Fragment key={l.id}>
                  <tr
                    onClick={() => toggleExpand(l.id)}
                    className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                  >
                    <td className="p-3 font-medium">{l.name}</td>
                    <td className="p-3" onClick={stop}>
                      {l.contact ? (
                        <Link href={`/contacts/${l.contact.id}`} className="text-crust hover:underline">
                          {l.contact.name}
                        </Link>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-neutral-400 text-xs">{l.customerNameRaw || "unmatched"}</span>
                          <ContactPicker onSelect={(c) => linkContact(l.id, c.id, c.name)} />
                        </div>
                      )}
                    </td>
                    <td className="p-3" onClick={stop}>
                      <select
                        className="border border-neutral-200 rounded px-2 py-1"
                        value={l.stage || ""}
                        onChange={(e) => updateField(l.id, "stage", e.target.value)}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3" onClick={stop}>
                      <select
                        className="border border-neutral-200 rounded px-2 py-1"
                        value={l.status}
                        onChange={(e) => updateStatus(l.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3" onClick={stop}>
                      <ConfidenceCell
                        key={`${l.id}-${l.winPct}`}
                        pct={Math.round((l.winPct ?? 0.55) * 100)}
                        onChange={(pct) => updateConfidence(l.id, pct)}
                      />
                    </td>
                    <td className="p-3" onClick={stop}>
                      <ValueCell value={l.value} onSave={(val) => updateValue(l.id, val)} />
                    </td>
                    <td className="p-3 whitespace-nowrap" onClick={stop}>
                      <EventDateCell
                        opportunityId={l.id}
                        eventDate={l.eventDate}
                        onSave={(dateStr) => updateEventDate(l.id, dateStr)}
                      />
                    </td>
                    <td className="p-3" onClick={stop}>
                      <button
                        onClick={() => toggleExpand(l.id, true)}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                        <span className="opacity-70">· {l._count.attempts}x</span>
                        {manyTouchesNoProgress && <AlertTriangle size={12} />}
                      </button>
                      <button
                        onClick={() => logContact(l.id)}
                        className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-neutral-400 hover:text-crust"
                        title="Log a contact attempt right now"
                      >
                        <Plus size={12} /> log
                      </button>
                    </td>
                    <td className="p-3">{l.priority || "—"}</td>
                    <td className="p-3" onClick={stop}>
                      {needsSaleFlag && (
                        <Link
                          href={`/sales/new?fromOpportunity=${l.id}`}
                          className="text-xs bg-basil text-white px-2 py-1 rounded-full font-medium whitespace-nowrap"
                        >
                          Create sale
                        </Link>
                      )}
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr className="bg-neutral-50/70">
                      <td colSpan={10} className="p-3" onClick={stop}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                          <div>
                            <span className="block text-xs font-semibold text-neutral-500 mb-1">NOTES</span>
                            <p className="text-neutral-700 whitespace-pre-wrap">{l.description || "—"}</p>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold text-neutral-500 mb-1">
                              LOSS REASON
                              {l.status === "Lost" && !l.lossReason && (
                                <span className="ml-1.5 text-sauce font-normal normal-case">please specify</span>
                              )}
                            </span>
                            <select
                              className={`border rounded px-2 py-1 text-sm w-full ${
                                l.status === "Lost" && !l.lossReason ? "border-sauce" : "border-neutral-200"
                              }`}
                              value={l.lossReason || ""}
                              onChange={(e) => updateField(l.id, "lossReason", e.target.value)}
                            >
                              <option value="">—</option>
                              {LOSS_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <span className="block text-xs font-semibold text-neutral-500 mb-1">SOURCE</span>
                            <p className="text-neutral-700">{l.source || "—"}</p>
                          </div>
                        </div>
                        <div className="border-t border-neutral-200 pt-3">
                          <AttemptLog
                            attempts={expandedAttempts}
                            onDelete={(attemptId) => deleteAttempt(l.id, attemptId)}
                            onAdd={(method, note) => logContact(l.id, method, note)}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-neutral-500 mt-2">{leads.length} lead(s)</p>
    </div>
  );
}

type Conflict = { type: "lead" | "sale"; id: string; label: string };

function EventDateCell({
  opportunityId,
  eventDate,
  onSave,
}: {
  opportunityId: string;
  eventDate: string | null;
  onSave: (dateStr: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toDateInputValue(eventDate));
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function checkConflicts(dateStr: string) {
    if (!dateStr) {
      setConflicts(null);
      return;
    }
    setChecking(true);
    const params = new URLSearchParams({ date: dateStr, excludeOpportunityId: opportunityId });
    const res = await fetch(`/api/opportunities/date-conflicts?${params.toString()}`);
    const data = await res.json();
    setConflicts(data.conflicts || []);
    setChecking(false);
  }

  function openPicker() {
    setDraft(toDateInputValue(eventDate));
    setConflicts(null);
    setOpen(true);
  }

  function handleDateChange(value: string) {
    setDraft(value);
    checkConflicts(value);
  }

  function handleSave() {
    onSave(draft);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-1.5 text-neutral-700 hover:text-crust group"
      >
        {formatDate(eventDate)}
        <Pencil size={12} className="text-neutral-300 group-hover:text-crust" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 bg-white border border-neutral-200 rounded-lg shadow-md p-3 w-64">
          <input
            type="date"
            className="border border-neutral-200 rounded px-2 py-1 text-sm w-full"
            value={draft}
            onChange={(e) => handleDateChange(e.target.value)}
          />

          <div className="mt-2 text-xs min-h-[1.5rem]">
            {checking && <span className="text-neutral-400">Checking for conflicts...</span>}
            {!checking && conflicts && conflicts.length === 0 && (
              <span className="flex items-center gap-1 text-basil">
                <CheckCircle2 size={13} /> No other bookings that day
              </span>
            )}
            {!checking && conflicts && conflicts.length > 0 && (
              <div className="text-sauce">
                <div className="flex items-center gap-1 font-medium">
                  <AlertTriangle size={13} /> Potential conflict:
                </div>
                <ul className="mt-1 space-y-0.5">
                  {conflicts.map((c) => (
                    <li key={`${c.type}-${c.id}`}>
                      {c.label} ({c.type === "sale" ? "booked sale" : "lead"})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 px-2 py-1">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="text-xs bg-crust text-white px-3 py-1 rounded">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  label,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((o) => o !== opt));
    else onChange([...selected, opt]);
  }

  const summary = selected.length === 0 ? `All ${label.toLowerCase()}es` : selected.join(", ");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white max-w-[220px] truncate"
      >
        <span className="truncate">{label}: {summary}</span>
        <ChevronDown size={14} className="shrink-0 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 bg-white border border-neutral-200 rounded-lg shadow-md py-1 min-w-[180px]">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-neutral-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:text-crust border-t border-neutral-100 mt-1"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ConfidenceCell({ pct, onChange }: { pct: number; onChange: (pct: number) => void }) {
  const [local, setLocal] = useState(pct);
  const color = confidenceColor(local);

  return (
    <div className="flex flex-col items-start gap-1 w-24">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {local}%
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onMouseUp={() => onChange(local)}
        onTouchEnd={() => onChange(local)}
        onBlur={() => onChange(local)}
        className="w-full h-1.5"
        style={{ accentColor: color.accent }}
      />
    </div>
  );
}

function ValueCell({ value, onSave }: { value: number | null; onSave: (val: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onSave(null);
    } else {
      const num = Number(trimmed);
      onSave(Number.isNaN(num) ? null : num);
    }
    setEditing(false);
  }

  function startEditing() {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        step="0.01"
        className="border border-neutral-200 rounded px-2 py-1 w-24 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className="flex items-center gap-1.5 text-neutral-700 hover:text-crust group"
    >
      {value != null ? `$${Number(value).toLocaleString()}` : "—"}
      <Pencil size={12} className="text-neutral-300 group-hover:text-crust" />
    </button>
  );
}

function AttemptLog({
  attempts,
  onDelete,
  onAdd,
}: {
  attempts: Attempt[];
  onDelete: (id: string) => void;
  onAdd: (method: string, note: string) => void;
}) {
  const [method, setMethod] = useState("Email");
  const [note, setNote] = useState("");

  return (
    <div className="max-w-xl">
      <h4 className="text-xs font-semibold text-neutral-500 mb-2">OUTREACH LOG</h4>
      {attempts.length === 0 && <p className="text-sm text-neutral-400 mb-2">No contact attempts logged yet.</p>}
      <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
        {attempts.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm bg-white rounded px-2 py-1.5">
            <span>
              <span className="font-medium">{formatDate(a.contactedAt)}</span>
              {a.method && <span className="text-neutral-500"> · {a.method}</span>}
              {a.note && <span className="text-neutral-500"> — {a.note}</span>}
            </span>
            <button onClick={() => onDelete(a.id)} className="text-neutral-300 hover:text-sauce text-xs">
              remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <select className="border border-neutral-200 rounded px-2 py-1 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          className="border border-neutral-200 rounded px-2 py-1 text-sm flex-1"
          placeholder="Optional note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={() => {
            onAdd(method, note);
            setNote("");
          }}
          className="bg-crust text-white text-sm px-3 py-1 rounded"
        >
          Log
        </button>
      </div>
    </div>
  );
}
