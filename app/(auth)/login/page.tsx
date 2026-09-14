"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthActionState } from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-brand-primary">
          Mindfreak Manager
        </h1>
        <p className="mt-1 text-sm text-brand-muted">
          Ingresa con tu cuenta para continuar.
        </p>

        <Card className="mt-8">
          <form action={formAction} className="space-y-4">
            <Input id="email" label="Correo" name="email" type="email" required autoComplete="email" />
            <Input
              id="password"
              label="Contraseña"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />

            {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

            <Button type="submit" loading={pending} className="w-full justify-center">
              Ingresar
            </Button>
          </form>
        </Card>

        <Link
          href="/recover-password"
          className="mt-4 inline-block text-sm text-brand-accent hover:underline"
        >
          Olvidé mi contraseña
        </Link>
      </div>
    </main>
  );
}
