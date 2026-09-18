"use client";

import { useActionState } from "react";
import { verifyMfaChallengeAction, type AuthActionState } from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initialState: AuthActionState = { error: null };

export default function MfaChallengePage() {
  const [state, formAction, pending] = useActionState(verifyMfaChallengeAction, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-brand-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-brand-primary">Verificación en dos pasos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Abre tu app autenticadora (Google Authenticator u otra) y escribe
          el código de 6 dígitos.
        </p>

        <Card className="mt-8">
          <form action={formAction} className="space-y-4">
            <Input
              id="code"
              label="Código de 6 dígitos"
              name="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              required
            />

            {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

            <Button type="submit" loading={pending} className="w-full justify-center">
              Verificar
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
