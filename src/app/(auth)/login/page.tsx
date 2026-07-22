"use client";

import { useActionState } from "react";
import { HaloLogo } from "@/components/HaloLogo";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-bg px-4">
      <HaloLogo variant="full" size={56} />

      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text">Sign in</h1>
        <p className="mt-1 text-sm text-text-muted">Discreet, secure access for your team and clients.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-muted" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {state.needsTotp && (
            <div>
              <label className="text-sm font-medium text-text-muted" htmlFor="totpCode">
                Two-factor code
              </label>
              <input
                id="totpCode"
                name="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          )}

          {state.error && <p className="text-sm font-medium text-text">⚠ {state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full text-sm disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
