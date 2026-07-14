import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { COOKIE_NAME, MAX_AGE_SECONDS, createSessionToken } from "@/lib/auth";
import { getClientIp, checkLockout, recordFailure, clearFailures } from "@/lib/loginSecurity";

export async function POST(req: NextRequest) {
  const { password, code } = await req.json();
  const ip = getClientIp(req);

  const lockedMinutes = await checkLockout(ip);
  if (lockedMinutes != null) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${lockedMinutes} minute(s).` },
      { status: 429 }
    );
  }

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // If a TOTP_SECRET is configured, 2FA is turned on: require a valid
  // authenticator code before issuing a session. If it isn't set, 2FA is
  // simply not enabled yet and login proceeds on password alone.
  const totpSecret = process.env.TOTP_SECRET;
  if (totpSecret) {
    if (!code) {
      // Password was right -- tell the client to prompt for the 6-digit code.
      // No cookie issued yet, and this doesn't count as a failure.
      return NextResponse.json({ requiresCode: true });
    }
    const validCode = authenticator.verify({ token: String(code), secret: totpSecret });
    if (!validCode) {
      await recordFailure(ip);
      return NextResponse.json({ error: "Invalid code", requiresCode: true }, { status: 401 });
    }
  }

  await clearFailures(ip);

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}
