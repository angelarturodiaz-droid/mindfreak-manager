"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--brand-surface)",
          color: "var(--brand-text)",
          border: "1px solid var(--brand-border)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.875rem",
        },
      }}
    />
  );
}

export { toast } from "sonner";
