"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthActionState } from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-background px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-brand-secondary text-base font-bold text-white">
            M
          </div>
          <div>
            <h1 className="text-xl font-semibold text-brand-primary">
              Mindfreak Manager
            </h1>
            <p className="mt-1 text-sm text-brand-muted">
              Ingresa con tu cuenta para continuar.
            </p>
          </div>
        </div>

        <Card className="mt-8 shadow-[var(--shadow-md)]">
          <form action={formAction} className="space-y-4">
            <Input id="email" label="Correo" name="email" type="email" required autoComplete="email" />
            <PasswordInput
              id="password"
              label="Contraseña"
              name="password"
              required
              autoComplete="current-password"
            />

            {state.requiresCaptcha && (
              <div>
                <p className="mb-2 text-xs text-brand-muted">
                  Detectamos varios intentos fallidos seguidos — confirma que
                  no eres un robot para continuar.
                </p>
                <TurnstileWidget />
              </div>
            )}

            {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

            <Button type="submit" loading={pending} className="w-full justify-center">
              Ingresar
            </Button>
          </form>
        </Card>

        <Link
          href="/recover-password"
          className="mt-4 block text-center text-sm text-brand-accent hover:underline"
        >
          Olvidé mi contraseña
        </Link>
      </div>
    </main>
  );
}
