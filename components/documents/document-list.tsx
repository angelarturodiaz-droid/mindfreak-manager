"use client";

import { useEffect, useState, useTransition } from "react";
import {
  deleteDocumentAction,
  getDocumentDownloadUrlAction,
} from "@/features/documents/actions";

type Doc = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Thumbnail({ doc }: { doc: Doc }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = doc.mime_type?.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    getDocumentDownloadUrlAction(doc.storage_path).then((result) => {
      if (!cancelled && result.url) setUrl(result.url);
    });
    return () => {
      cancelled = true;
    };
  }, [doc.storage_path, isImage]);

  if (!isImage) {
    return (
      <div className="flex h-10 w-10 items-center justify-center border border-brand-muted/20 bg-brand-surface text-xs text-brand-muted">
        {doc.mime_type?.includes("pdf") ? "PDF" : "Archivo"}
      </div>
    );
  }

  if (!url) {
    return <div className="h-10 w-10 animate-pulse bg-brand-muted/10" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={doc.file_name}
      className="h-10 w-10 cursor-pointer border border-brand-muted/20 object-cover"
      onClick={() => window.open(url, "_blank")}
    />
  );
}

function DocumentRow({
  doc,
  canDelete,
  revalidatePathValue,
}: {
  doc: Doc;
  canDelete: boolean;
  revalidatePathValue: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleView() {
    setError(null);
    startTransition(async () => {
      const result = await getDocumentDownloadUrlAction(doc.storage_path);
      if (result.error || !result.url) {
        setError(result.error ?? "No se pudo generar el link.");
        return;
      }
      window.open(result.url, "_blank");
    });
  }

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await getDocumentDownloadUrlAction(doc.storage_path, {
        download: doc.file_name,
      });
      if (result.error || !result.url) {
        setError(result.error ?? "No se pudo generar el link.");
        return;
      }
      window.open(result.url, "_blank");
    });
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar "${doc.file_name}"? No se puede deshacer.`)) return;
    startTransition(() =>
      deleteDocumentAction(doc.id, doc.storage_path, revalidatePathValue),
    );
  }

  return (
    <tr className="border-b border-brand-muted/10">
      <td className="py-2">
        <Thumbnail doc={doc} />
      </td>
      <td className="py-2">{doc.file_name}</td>
      <td className="py-2 text-brand-muted">{formatSize(doc.size_bytes)}</td>
      <td className="py-2 text-brand-muted">
        {new Date(doc.created_at).toLocaleDateString("es-DO")}
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={handleView}
          disabled={isPending}
          className="mr-3 text-brand-accent hover:underline disabled:opacity-50"
        >
          Ver
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isPending}
          className="mr-3 text-brand-muted hover:text-brand-text disabled:opacity-50"
        >
          Descargar
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-brand-muted hover:text-brand-danger disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
        {error && <p className="text-xs text-brand-danger">{error}</p>}
      </td>
    </tr>
  );
}

export function DocumentList({
  documents,
  canDelete,
  revalidatePathValue,
}: {
  documents: Doc[];
  canDelete: boolean;
  revalidatePathValue: string;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-brand-muted">Sin documentos todavía.</p>;
  }

  return (
    <table className="w-full max-w-2xl border-collapse text-sm">
      <thead>
        <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
          <th className="py-2 font-medium"></th>
          <th className="py-2 font-medium">Archivo</th>
          <th className="py-2 font-medium">Tamaño</th>
          <th className="py-2 font-medium">Subido</th>
          <th className="py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            canDelete={canDelete}
            revalidatePathValue={revalidatePathValue}
          />
        ))}
      </tbody>
    </table>
  );
}
