"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next.startsWith("/admin") ? next : "/admin");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-24">
      <h1 className="font-display text-2xl font-semibold">
        River Dynasty Capital
      </h1>
      <p className="mt-1 text-sm text-muted">Admin sign in</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="tnum mt-1 w-full rounded-sm border border-hairline bg-paper px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-loss">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-sm bg-navy px-3 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-xs text-muted">
        <a href="/" className="underline">
          ← Back to the public site
        </a>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
