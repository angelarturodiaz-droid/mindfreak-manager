"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/features/auth/actions";

const initialState: AuthActionState = { error: null };

export default function RecoverPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-brand-primary">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-brand-muted">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-brand-text"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-brand-primary py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>

        {state.submitted && (
          <p className="mt-4 text-sm text-brand-muted">
            Si el correo existe, en unos minutos recibirás un enlace para
            continuar.
          </p>
        )}

        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-brand-accent hover:underline"
        >
          Volver a ingresar
        </Link>
      </div>
    </main>
  );
}
