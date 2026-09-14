"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initialState: AuthActionState = { error: null };

export default function RecoverPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-brand-primary">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-brand-muted">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>

        <Card className="mt-8">
          <form action={formAction} className="space-y-4">
            <Input id="email" label="Correo" name="email" type="email" required autoComplete="email" />

            <Button type="submit" loading={pending} className="w-full justify-center">
              Enviar enlace
            </Button>
          </form>
        </Card>

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
