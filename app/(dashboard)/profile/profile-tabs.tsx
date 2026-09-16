"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function ProfileTabs({
  profileContent,
  securityContent,
}: {
  profileContent: ReactNode;
  securityContent: ReactNode;
}) {
  const [tab, setTab] = useState<"profile" | "security">("profile");

  return (
    <div>
      <nav className="mb-6 flex gap-1 border-b border-brand-border">
        <button
          type="button"
          onClick={() => setTab("profile")}
          className={
            tab === "profile"
              ? "border-b-2 border-brand-accent px-3 py-2 text-sm font-medium text-brand-accent"
              : "border-b-2 border-transparent px-3 py-2 text-sm text-brand-muted hover:text-brand-text"
          }
        >
          Perfil
        </button>
        <button
          type="button"
          onClick={() => setTab("security")}
          className={
            tab === "security"
              ? "border-b-2 border-brand-accent px-3 py-2 text-sm font-medium text-brand-accent"
              : "border-b-2 border-transparent px-3 py-2 text-sm text-brand-muted hover:text-brand-text"
          }
        >
          Inicio de sesión y seguridad
        </button>
      </nav>

      {tab === "profile" ? profileContent : securityContent}
    </div>
  );
}
