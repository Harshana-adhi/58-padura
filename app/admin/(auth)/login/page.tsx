"use client";

import { useActionState } from "react";
import { loginAction, type LoginResult } from "@/server/actions/auth";

const initialState: LoginResult = { ok: true };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: LoginResult, formData: FormData) => loginAction(formData),
    initialState
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-sin mb-6 text-center text-2xl font-bold">58 පැදුර — Admin</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            name="operator"
            required
            maxLength={60}
            autoComplete="name"
            className="rounded-md bg-stage-raised px-3 py-2 ring-1 ring-stage-border outline-none focus:ring-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passcode
          <input
            name="passcode"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md bg-stage-raised px-3 py-2 ring-1 ring-stage-border outline-none focus:ring-accent"
          />
        </label>
        {!state.ok && state.error && <p className="text-sm text-red">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
