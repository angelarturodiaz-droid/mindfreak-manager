export type EcfFileKind = "pdf" | "xml";

/** PDF o XML del e-CF (por extensión o tipo); cualquier otra cosa → null. */
export function ecfFileKind(name: string, mime: string): EcfFileKind | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (n.endsWith(".xml") || mime === "application/xml" || mime === "text/xml") return "xml";
  return null;
}
