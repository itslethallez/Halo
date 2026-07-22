"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-brand-900">Sign in to TrueReach</h1>
        <p className="mt-1 text-sm text-ink-600">Discreet, secure access for your team and clients.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {state.needsTotp && (
            <div>
              <label className="text-sm font-medium text-ink-700" htmlFor="totpCode">
                Two-factor code
              </label>
              <input
                id="totpCode"
                name="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          {state.error && <p className="text-sm text-alert-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
