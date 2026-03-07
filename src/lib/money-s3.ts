import * as iconv from "iconv-lite";
import type { Document, ExtractedData } from "@/types/database";

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0.00";
  return num.toFixed(2);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // Ensure YYYY-MM-DD format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return dateStr;
}

function isReceivedInvoice(data: ExtractedData): boolean {
  const docType = (data.document_type || "").toLowerCase();
  return docType.includes("přijat") || docType.includes("prijat");
}

function generateFaktura(doc: Document): string {
  const data = doc.extracted_data;
  if (!data) return "";

  const received = isReceivedInvoice(data);
  const rada = received ? "PF" : "VF";

  const items = data.items && data.items.length > 0 ? data.items : null;

  let polozkyXml = "";
  if (items) {
    const polozky = items
      .map((item) => {
        const qty = item.quantity ?? 1;
        const unitPrice = item.unit_price ?? 0;
        const total = item.total ?? qty * unitPrice;
        return `        <Polozka>
          <Popis>${escapeXml(item.description)}</Popis>
          <Mnozstvi>${formatNumber(qty)}</Mnozstvi>
          <JednotkaCena>${formatNumber(unitPrice)}</JednotkaCena>
          <Sazba>${data.vat_rate ?? 21}</Sazba>
          <Celkem>${formatNumber(total)}</Celkem>
        </Polozka>`;
      })
      .join("\n");
    polozkyXml = `      <SeznamPolozek>\n${polozky}\n      </SeznamPolozek>`;
  } else {
    // Single summary item from totals
    const total = data.total_amount ?? 0;
    const vatBase = data.vat_base ?? total;
    polozkyXml = `      <SeznamPolozek>
        <Polozka>
          <Popis>${escapeXml(data.notes || "Souhrnná položka")}</Popis>
          <Mnozstvi>1.00</Mnozstvi>
          <JednotkaCena>${formatNumber(vatBase)}</JednotkaCena>
          <Sazba>${data.vat_rate ?? 21}</Sazba>
          <Celkem>${formatNumber(total)}</Celkem>
        </Polozka>
      </SeznamPolozek>`;
  }

  // Use supplier for received invoices, customer for issued
  const firma = received ? data.supplier : data.customer;

  return `    <Faktura>
      <Doklad>
        <Rada>${rada}</Rada>
        <Cislo>${escapeXml(data.invoice_number)}</Cislo>
        <Datum>${formatDate(data.issue_date)}</Datum>
        <DatumSplatnosti>${formatDate(data.due_date)}</DatumSplatnosti>
        <Popis>${escapeXml(data.notes || `Faktura ${data.invoice_number || ""}`.trim())}</Popis>
        <SumZaklad>${formatNumber(data.vat_base)}</SumZaklad>
        <SumDPH>${formatNumber(data.vat_amount)}</SumDPH>
        <SumCelkem>${formatNumber(data.total_amount)}</SumCelkem>
        <Mena>${escapeXml(data.currency || "CZK")}</Mena>
        <VariabilniSymbol>${escapeXml(data.variable_symbol)}</VariabilniSymbol>
      </Doklad>
      <Firma>
        <Nazev>${escapeXml(firma?.name)}</Nazev>
        <ICO>${escapeXml(firma?.ico)}</ICO>
        <DIC>${escapeXml(firma?.dic)}</DIC>
        <Adresa>${escapeXml(firma?.address)}</Adresa>
      </Firma>
${polozkyXml}
    </Faktura>`;
}

export type ExportType = "received" | "issued" | "all";

export function generateMoneyS3Xml(
  documents: Document[],
  type: ExportType
): string {
  const filtered = documents.filter((doc) => {
    if (!doc.extracted_data) return false;
    if (type === "all") return true;
    const received = isReceivedInvoice(doc.extracted_data);
    return type === "received" ? received : !received;
  });

  const faktury = filtered.map((doc) => generateFaktura(doc)).join("\n");

  return `<?xml version="1.0" encoding="Windows-1250"?>
<MoneyData Version="1.0">
  <SeznamFaktur>
${faktury}
  </SeznamFaktur>
</MoneyData>`;
}

export function encodeToWindows1250(xmlString: string): Buffer {
  return iconv.encode(xmlString, "win1250");
}
