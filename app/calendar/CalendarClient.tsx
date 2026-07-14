"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, toDateInputValue, todayLocalDateStr } from "@/lib/dates";

type Opportunity = {
  id: string;
  name: string;
  status: string;
  eventDate: string | null;
  contact: { id: string; name: string } | null;
  customerNameRaw: string | null;
  sales: { id: string }[];
};

type Sale = {
  id: string;
  eventDate: string | null;
  clientNameRaw: string | null;
  contact: { id: string; name: string } | null;
  opportunity: { id: string; name: string } | null;
};

type Color = "red" | "green" | "blue";

type Entry = {
  id: string;
  dateKey: string;
  label: string;
  sublabel: string;
  color: Color;
  type: "lead" | "sale";
  href?: string;
};

type Cell = { dateKey: string; day: number; inMonth: boolean };

const colorStyles: Record<Color, { dot: string; bg: string; text: string; border: string }> = {
  red: { dot: "bg-sauce", bg: "bg-sauce/10", text: "text-sauce", border: "border-sauce/30" },
  green: { dot: "bg-basil", bg: "bg-basil/10", text: "text-basil", border: "border-basil/30" },
  blue: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

function leadColor(status: string): Color {
  if (status === "Lost" || status === "Abandoned") return "red";
  if (status === "Won") return "green";
  return "blue";
}

function buildMonthGrid(year: number, month: number): Cell[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: Cell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const d = new Date(Date.UTC(year, month - 1, day));
    cells.push({ dateKey: d.toISOString().slice(0, 10), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month, day));
    cells.push({ dateKey: d.toISOString().slice(0, 10), day, inMonth: true });
  }

  while (cells.length < 42) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    const d = new Date(Date.UTC(year, month + 1, day));
    cells.push({ dateKey: d.toISOString().slice(0, 10), day, inMonth: false });
  }

  return cells;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarClient() {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [oppRes, saleRes] = await Promise.all([
        fetch("/api/opportunities"),
        fetch("/api/sales"),
      ]);
      const oppData = await oppRes.json();
      const saleData = await saleRes.json();
      setOpportunities(oppData.opportunities || []);
      setSales(saleData.sales || []);
      setLoading(false);
    }
    load();
  }, []);

  // Merge leads + sales into calendar entries. A Won lead that already has a
  // linked Sale is represented only by the Sale (avoids showing the same
  // booking twice on the same day).
  const entriesByDate = useMemo(() => {
    const map = new Map<string, Entry[]>();

    function push(entry: Entry) {
      const list = map.get(entry.dateKey) || [];
      list.push(entry);
      map.set(entry.dateKey, list);
    }

    for (const opp of opportunities) {
      if (!opp.eventDate) continue;
      if (opp.sales.length > 0) continue; // shown as its Sale instead
      push({
        id: opp.id,
        dateKey: toDateInputValue(opp.eventDate),
        label: opp.contact?.name || opp.customerNameRaw || opp.name,
        sublabel: `Lead · ${opp.status}`,
        color: leadColor(opp.status),
        type: "lead",
      });
    }

    for (const sale of sales) {
      if (!sale.eventDate) continue;
      push({
        id: sale.id,
        dateKey: toDateInputValue(sale.eventDate),
        label: sale.contact?.name || sale.clientNameRaw || sale.opportunity?.name || "Sale",
        sublabel: "Sale · booked",
        color: "green",
        type: "sale",
        href: `/sales/${sale.id}`,
      });
    }

    // Green (Won leads / Sales) always floats to the top of each day's list,
    // so it's still visible even when a day is packed and gets truncated.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.color === "green" && b.color !== "green") return -1;
        if (b.color === "green" && a.color !== "green") return 1;
        return 0;
      });
    }

    return map;
  }, [opportunities, sales]);

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const today = todayLocalDateStr();
  const selectedEntries = selectedDate ? entriesByDate.get(selectedDate) || [] : [];

  function goToMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
    setSelectedDate(null);
  }

  function goToToday() {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
    setSelectedDate(today);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-neutral-800">Calendar</h1>
        <div className="flex items-center gap-3 text-xs">
          <Legend color="red" label="Lost / Abandoned" />
          <Legend color="green" label="Won / Sale" />
          <Legend color="blue" label="Open / other" />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToMonth(-1)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => goToMonth(1)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
          <span className="ml-2 font-semibold text-neutral-800">{monthLabel}</span>
        </div>
        <button
          onClick={goToToday}
          className="text-xs border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50"
        >
          Today
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500 text-sm">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50/50">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="p-2 text-center text-xs font-medium text-neutral-500">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const dayEntries = entriesByDate.get(cell.dateKey) || [];
              const isToday = cell.dateKey === today;
              const isSelected = cell.dateKey === selectedDate;
              const visible = dayEntries.slice(0, 3);
              const overflow = dayEntries.length - visible.length;

              return (
                <button
                  key={cell.dateKey}
                  onClick={() => setSelectedDate(cell.dateKey)}
                  className={`min-h-[76px] sm:min-h-[92px] border-b border-r border-neutral-100 p-1.5 text-left align-top flex flex-col gap-0.5 ${
                    cell.inMonth ? "bg-white" : "bg-neutral-50/40"
                  } ${isSelected ? "ring-2 ring-inset ring-crust" : ""} hover:bg-neutral-50`}
                >
                  <span
                    className={`text-xs w-5 h-5 flex items-center justify-center rounded-full ${
                      isToday ? "bg-crust text-white font-semibold" : cell.inMonth ? "text-neutral-700" : "text-neutral-300"
                    }`}
                  >
                    {cell.day}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {visible.map((e) => (
                      <span
                        key={`${e.type}-${e.id}`}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${colorStyles[e.color].bg} ${colorStyles[e.color].text}`}
                        title={e.label}
                      >
                        {e.label}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[10px] text-neutral-400 px-1">+{overflow} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDate && (
        <div className="mt-4 bg-white rounded-xl border border-neutral-200 p-4">
          <h3 className="font-semibold text-neutral-800 mb-3">{formatDate(selectedDate)}</h3>
          {selectedEntries.length === 0 && (
            <p className="text-sm text-neutral-400">Nothing scheduled this day.</p>
          )}
          <div className="space-y-2">
            {selectedEntries.map((e) => (
              <div
                key={`${e.type}-${e.id}`}
                className={`flex items-center justify-between border-l-4 rounded px-3 py-2 ${colorStyles[e.color].border} ${colorStyles[e.color].bg}`}
              >
                <div>
                  <div className="text-sm font-medium text-neutral-800">{e.label}</div>
                  <div className="text-xs text-neutral-500">{e.sublabel}</div>
                </div>
                {e.href ? (
                  <Link href={e.href} className={`text-xs font-semibold ${colorStyles[e.color].text} hover:underline`}>
                    View
                  </Link>
                ) : (
                  <Link href="/leads" className={`text-xs font-semibold ${colorStyles[e.color].text} hover:underline`}>
                    View in Leads
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: Color; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-neutral-500">
      <span className={`w-2.5 h-2.5 rounded-full ${colorStyles[color].dot}`} />
      {label}
    </span>
  );
}
