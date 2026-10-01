import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import {
  DELIVERY_TYPE_TEXT,
  DEFAULT_DELIVERY_PLACE,
  defaultFooterNote,
  defaultIntroText,
  formatTotal,
  showQuantityColumn,
  totalQuantity,
} from "@/features/deliveries/schema";

/**
 * Acuse de entrega — mismo formato que el modelo "Acuse_de_Entrega_Mindfreak":
 * banda oscura arriba (logo + nombre, "ACUSE DE ENTREGA" + subtítulo),
 * destinatario / fecha, referencia, párrafo, tabla numerada (mínimo 8
 * filas), total, nota y los dos recuadros de firma (Entregado por / Recibido
 * por con espacio para sello), y banda oscura al pie.
 *
 * Se renderiza en el navegador (ver claude/pdf-generacion-cliente.md).
 */

export type DeliveryReceiptPdfData = {
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    logo_url: string | null;
    brand_primary: string;
    brand_accent: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  receipt: {
    number: string;
    status: string;
    delivery_type: string;
    subtitle: string | null;
    delivery_date: string;
    place: string | null;
    recipient_name: string;
    recipient_short_name: string | null;
    recipient_department: string | null;
    reference: string | null;
    intro_text: string | null;
    notes: string | null;
    copies: number;
    delivered_by_name: string | null;
    delivered_by_id_number: string | null;
  };
  items: { description: string; reference: string | null; quantity: number }[];
};

const MIN_ROWS = 8;

function tint(hex: string, whiteFactor: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * whiteFactor);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function websiteFrom(email: string | null): string | null {
  const domain = email?.split("@")[1]?.trim();
  if (!domain || /gmail|hotmail|outlook|yahoo|icloud/i.test(domain)) return null;
  return domain.toLowerCase();
}

/** "Mindfreak Events" + "Mindfreak Events SRL" → ["MINDFREAK", "EVENTS SRL"]. */
function splitBrand(name: string, legal: string | null): [string, string] {
  const words = name.trim().split(/\s+/);
  const big = (words[0] ?? name).toUpperCase();
  const source = (legal ?? name).trim().split(/\s+/);
  const rest = source.slice(1).join(" ").toUpperCase();
  return [big, rest];
}

export function DeliveryReceiptPdfDocument({ company, receipt, items }: DeliveryReceiptPdfData) {
  registerPdfFonts();

  const dark = !company.brand_primary || company.brand_primary.toLowerCase() === "#000000" ? "#141b20" : company.brand_primary;
  const accent = company.brand_accent || "#17a6b8";
  const accentSoft = tint(accent, 0.93);
  const muted = "#5b6b73";
  const line = "#cfd8dc";
  const text = DELIVERY_TYPE_TEXT[receipt.delivery_type] ?? DELIVERY_TYPE_TEXT.OTHER;
  const legalName = (company.legal_name ?? company.name).toUpperCase();
  const [brandBig, brandSmall] = splitBrand(company.name, company.legal_name);
  const showQty = showQuantityColumn(receipt.delivery_type, items);
  const total = totalQuantity(items);
  const rows = [...items, ...Array.from({ length: Math.max(0, MIN_ROWS - items.length) }, () => null)];
  const intro =
    receipt.intro_text?.trim() ||
    defaultIntroText({
      companyName: company.legal_name ?? company.name,
      recipientName: receipt.recipient_name,
      recipientShortName: receipt.recipient_short_name,
      deliveryType: receipt.delivery_type,
      reference: receipt.reference,
    });
  const footerNote = defaultFooterNote(receipt.delivery_type, receipt.copies);
  const website = websiteFrom(company.email);
  const isDraft = receipt.status === "DRAFT";
  const isCancelled = receipt.status === "CANCELLED";

  const s = StyleSheet.create({
    page: { fontFamily: "Roboto", fontSize: 9, color: "#1b2327", paddingBottom: 56 },
    topLine: { height: 4, backgroundColor: accent },
    header: {
      backgroundColor: dark,
      paddingHorizontal: 36,
      paddingVertical: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    brandRow: { flexDirection: "row", alignItems: "center" },
    logoRing: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2,
      borderColor: accent,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      overflow: "hidden",
    },
    logoImg: { width: 30, height: 30, objectFit: "contain" },
    logoLetter: { color: dark, fontSize: 15, fontWeight: 700 },
    brandBig: { color: "#ffffff", fontSize: 18, fontWeight: 700, letterSpacing: 2 },
    brandSmall: { color: accent, fontSize: 7.5, letterSpacing: 3, marginTop: 2 },
    titleBox: { alignItems: "flex-end" },
    title: { color: "#ffffff", fontSize: 15, fontWeight: 700, letterSpacing: 3 },
    subtitle: { color: "#aeb9bf", fontSize: 7, letterSpacing: 2, marginTop: 4 },
    body: { paddingHorizontal: 36, paddingTop: 22 },
    label: { color: accent, fontSize: 7, fontWeight: 700, letterSpacing: 1.5 },
    recipientRow: { flexDirection: "row", justifyContent: "space-between" },
    recipientName: { fontSize: 10, fontWeight: 700, marginTop: 4 },
    recipientDept: { color: accent, fontSize: 8, marginTop: 3 },
    dateBox: { alignItems: "flex-start", minWidth: 150 },
    dateText: { fontSize: 9, marginTop: 4 },
    refBox: {
      marginTop: 10,
      flexDirection: "row",
      borderWidth: 0.8,
      borderColor: line,
      borderRadius: 4,
    },
    refLabelBox: { backgroundColor: accentSoft, paddingHorizontal: 12, paddingVertical: 7, justifyContent: "center" },
    refValue: { flex: 1, paddingHorizontal: 10, paddingVertical: 7, fontSize: 8.5 },
    intro: { marginTop: 18, fontSize: 8.5, lineHeight: 1.45 },
    table: { marginTop: 16, borderWidth: 0.8, borderColor: line, borderRadius: 4 },
    thead: { flexDirection: "row", backgroundColor: dark, paddingVertical: 7, paddingHorizontal: 10 },
    th: { color: "#ffffff", fontSize: 7, fontWeight: 700, letterSpacing: 1.2 },
    tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 0.6, borderTopColor: line, minHeight: 21 },
    colNo: { width: 34 },
    colDesc: { flex: 1, paddingRight: 8 },
    colQty: { width: 44, textAlign: "right", paddingRight: 10 },
    colRef: { width: 150 },
    no: { color: accent, fontWeight: 700, fontSize: 8.5 },
    td: { fontSize: 8.5 },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "#eef2f3",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderTopWidth: 0.8,
      borderTopColor: line,
    },
    totalLabel: { color: accent, fontSize: 7.5, fontWeight: 700, letterSpacing: 1.5 },
    totalValue: { fontSize: 11, fontWeight: 700, marginRight: 40 },
    note: { marginTop: 8, color: muted, fontSize: 7.5, lineHeight: 1.4 },
    signRow: { flexDirection: "row", marginTop: 34, gap: 18 },
    signBox: { flex: 1, borderWidth: 0.8, borderColor: line, borderTopWidth: 3, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
    signTitle: { fontSize: 8.5, fontWeight: 700, letterSpacing: 2 },
    signSub: { color: muted, fontSize: 7.5, marginTop: 3 },
    signLine: { borderBottomWidth: 0.8, borderBottomColor: "#1b2327", marginTop: 34, width: "72%" },
    signLabel: { color: muted, fontSize: 6.5, letterSpacing: 1.5, marginTop: 3 },
    field: { flexDirection: "row", alignItems: "flex-end", marginTop: 12 },
    fieldLabel: { fontSize: 7.5, width: 58 },
    fieldValue: { flex: 1, borderBottomWidth: 0.6, borderBottomColor: accent, fontSize: 7.5, paddingBottom: 1, minHeight: 10 },
    sealBox: {
      position: "absolute",
      right: 12,
      top: 12,
      width: 66,
      height: 54,
      borderWidth: 0.8,
      borderStyle: "dashed",
      borderColor: accent,
      borderRadius: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    sealText: { color: muted, fontSize: 6, letterSpacing: 1 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: dark,
      paddingHorizontal: 36,
      paddingVertical: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: { color: "#ffffff", fontSize: 7 },
    footerRight: { color: accent, fontSize: 7 },
    watermarkWrap: {
      position: "absolute",
      top: 300,
      left: 0,
      right: 0,
      alignItems: "center",
      transform: "rotate(-24deg)",
    },
    watermark: {
      fontSize: 78,
      fontWeight: 700,
      letterSpacing: 8,
      color: isCancelled ? "rgba(240, 68, 56, 0.16)" : "rgba(120, 132, 145, 0.16)",
    },
    numberTag: { color: "#aeb9bf", fontSize: 7, marginTop: 3, letterSpacing: 1 },
  });

  return (
    <Document title={`Acuse de entrega ${receipt.number}`} author={company.legal_name ?? company.name}>
      <Page size="LETTER" style={s.page}>
        <View style={s.topLine} fixed />
        <View style={s.header}>
          <View style={s.brandRow}>
            <View style={s.logoRing}>
              {company.logo_url ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer
                <Image src={company.logo_url} style={s.logoImg} />
              ) : (
                <Text style={s.logoLetter}>{brandBig.charAt(0)}</Text>
              )}
            </View>
            <View>
              <Text style={s.brandBig}>{brandBig}</Text>
              {brandSmall ? <Text style={s.brandSmall}>{brandSmall}</Text> : null}
            </View>
          </View>
          <View style={s.titleBox}>
            <Text style={s.title}>ACUSE DE ENTREGA</Text>
            <Text style={s.subtitle}>{(receipt.subtitle?.trim() || text.subtitle).toUpperCase()}</Text>
            <Text style={s.numberTag}>No. {receipt.number}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.recipientRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={s.label}>DESTINATARIO</Text>
              <Text style={s.recipientName}>
                {receipt.recipient_name}
                {receipt.recipient_short_name ? ` (${receipt.recipient_short_name})` : ""}
              </Text>
              {receipt.recipient_department ? <Text style={s.recipientDept}>{receipt.recipient_department}</Text> : null}
            </View>
            <View style={s.dateBox}>
              <Text style={[s.label, { alignSelf: "flex-end" }]}>FECHA</Text>
              <Text style={s.dateText}>{receipt.place?.trim() || DEFAULT_DELIVERY_PLACE}</Text>
              <Text style={s.dateText}>{longDate(receipt.delivery_date)}</Text>
            </View>
          </View>

          {receipt.reference ? (
            <View style={s.refBox}>
              <View style={s.refLabelBox}>
                <Text style={s.label}>REFERENCIA</Text>
              </View>
              <Text style={s.refValue}>{receipt.reference}</Text>
            </View>
          ) : null}

          <Text style={s.intro}>{intro}</Text>

          <View style={s.table}>
            <View style={s.thead} fixed>
              <Text style={[s.th, s.colNo]}>NO.</Text>
              <Text style={[s.th, s.colDesc]}>{text.itemHeader.toUpperCase()}</Text>
              {showQty && <Text style={[s.th, s.colQty]}>CANT.</Text>}
              <Text style={[s.th, s.colRef]}>{text.referenceHeader.toUpperCase()}</Text>
            </View>
            {rows.map((item, i) => (
              <View
                key={i}
                style={[s.tr, { backgroundColor: i % 2 === 1 ? accentSoft : "#ffffff" }]}
                wrap={false}
              >
                <Text style={[s.no, s.colNo]}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={[s.td, s.colDesc]}>{item?.description ?? ""}</Text>
                {showQty && (
                  <Text style={[s.td, s.colQty]}>
                    {item ? (Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2)) : ""}
                  </Text>
                )}
                <Text style={[s.td, s.colRef]}>{item?.reference ?? ""}</Text>
              </View>
            ))}
            <View style={s.totalRow} wrap={false}>
              <Text style={s.totalLabel}>{text.totalLabel.toUpperCase()}</Text>
              <Text style={s.totalValue}>{formatTotal(total)}</Text>
            </View>
          </View>

          <Text style={s.note}>
            {footerNote}
            {receipt.notes?.trim() ? ` ${receipt.notes.trim()}` : ""}
          </Text>

          <View style={s.signRow} wrap={false}>
            <View style={[s.signBox, { borderTopColor: accent }]}>
              <Text style={s.signTitle}>ENTREGADO POR</Text>
              <Text style={s.signSub}>{legalName}</Text>
              <View style={s.signLine} />
              <Text style={s.signLabel}>FIRMA</Text>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Nombre:</Text>
                <Text style={s.fieldValue}>{receipt.delivered_by_name ?? ""}</Text>
              </View>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Cédula:</Text>
                <Text style={s.fieldValue}>{receipt.delivered_by_id_number ?? ""}</Text>
              </View>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Fecha:</Text>
                <Text style={s.fieldValue}> </Text>
              </View>
            </View>

            <View style={[s.signBox, { borderTopColor: dark }]}>
              <View style={s.sealBox}>
                <Text style={s.sealText}>SELLO</Text>
              </View>
              <Text style={s.signTitle}>RECIBIDO POR</Text>
              <Text style={s.signSub}>{receipt.recipient_short_name?.trim() || receipt.recipient_name}</Text>
              <View style={s.signLine} />
              <Text style={s.signLabel}>FIRMA</Text>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Nombre:</Text>
                <Text style={s.fieldValue}> </Text>
              </View>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Cargo:</Text>
                <Text style={s.fieldValue}> </Text>
              </View>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Fecha/hora:</Text>
                <Text style={s.fieldValue}> </Text>
              </View>
            </View>
          </View>
        </View>

        {(isDraft || isCancelled) && (
          <View style={s.watermarkWrap} fixed>
            <Text style={s.watermark}>{isCancelled ? "ANULADO" : "BORRADOR"}</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>
            <Text style={{ fontWeight: 700 }}>{legalName}</Text>
            {company.address ? `   ·   ${company.address}` : ""}
            {company.tax_id ? `   ·   RNC ${company.tax_id}` : ""}
          </Text>
          <Text style={s.footerRight}>{website ?? company.phone ?? ""}</Text>
        </View>
      </Page>
    </Document>
  );
}
