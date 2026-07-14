// Event dates are stored as date-only values (midnight UTC, e.g. "2026-06-14"
// becomes 2026-06-14T00:00:00.000Z in the database). If you format that with
// `.toLocaleDateString()` the browser converts it to your *local* timezone
// first -- for anyone west of UTC that pushes midnight back into the previous
// day, so June 14th shows up as June 13th. Formatting in the UTC timezone
// keeps the calendar day that was actually stored.

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

// For populating <input type="date"> which expects "YYYY-MM-DD".
export function toDateInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Today's date in the *browser's* local timezone, as "YYYY-MM-DD". Use this
// (not `new Date()`) whenever logging a same-day event like a contact
// attempt, so it lands on the calendar day the user actually sees on their
// screen instead of whatever day the server's clock/timezone happens to be on.
export function todayLocalDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
