import { prisma } from "@/lib/prisma";

// After this many failed attempts from the same IP, lock it out for a while.
const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

export function getClientIp(req: Request): string {
  // Vercel (and most proxies) set this header; take the first hop, which is
  // the original client. Falls back to a shared bucket if it's ever missing
  // (e.g. local dev), which just means local requests share one counter.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

// Returns minutes remaining if this IP is currently locked out, or null if
// it's free to try.
export async function checkLockout(ip: string): Promise<number | null> {
  const record = await prisma.loginAttempt.findUnique({ where: { ip } });
  if (!record?.lockedUntil) return null;
  const msLeft = record.lockedUntil.getTime() - Date.now();
  if (msLeft <= 0) return null;
  return Math.ceil(msLeft / 60000);
}

// Call after any failed password or code check. Locks the IP out once it
// crosses the threshold.
export async function recordFailure(ip: string): Promise<void> {
  const record = await prisma.loginAttempt.upsert({
    where: { ip },
    create: { ip, failedCount: 1 },
    update: { failedCount: { increment: 1 } },
  });

  if (record.failedCount >= MAX_FAILURES) {
    await prisma.loginAttempt.update({
      where: { ip },
      data: {
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
        failedCount: 0,
      },
    });
  }
}

// Call once login (password + 2FA code, if enabled) fully succeeds.
export async function clearFailures(ip: string): Promise<void> {
  await prisma.loginAttempt
    .update({ where: { ip }, data: { failedCount: 0, lockedUntil: null } })
    .catch(() => {
      // No row for this IP yet -- nothing to clear.
    });
}
