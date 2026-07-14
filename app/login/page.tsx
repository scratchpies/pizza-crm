"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function attempt(body: { password: string; code?: string }) {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (res.ok && !data.requiresCode) {
      router.push(params.get("from") || "/");
      router.refresh();
      return;
    }

    if (data.requiresCode) {
      setNeedsCode(true);
      if (!res.ok) setError(data.error || "Invalid code. Try again.");
      return;
    }

    setError(data.error || "Wrong password. Try again.");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsCode) {
      attempt({ password, code });
    } else {
      attempt({ password });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow rounded-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-crust">🍕 Scratch Pies CRM</h1>

        {!needsCode && (
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              autoFocus
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {needsCode && (
          <div>
            <label className="block text-sm font-medium mb-1">Authenticator code</label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="6-digit code"
              className="w-full border rounded px-3 py-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="text-xs text-neutral-400 mt-1">
              Open your authenticator app for the current code.
            </p>
          </div>
        )}

        {error && <p className="text-sauce text-sm">{error}</p>}

        <button
          disabled={loading}
          className="w-full bg-crust text-white rounded py-2 font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in..." : needsCode ? "Verify" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
