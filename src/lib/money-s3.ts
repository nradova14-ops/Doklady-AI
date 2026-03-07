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
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return dateStr;
}

function isReceivedInvoice(data: ExtractedData): boolean {
  const docType = (data.document_type || "").toLowerCase();
  if (docType.includes("přijat") || docType.includes("prijat")) return true;
  if (docType.includes("vydán") || docType.includes("vydan")) return false;
  const hasSupplier = !!data.supplier?.name;
  const hasCustomer = !!data.customer?.name;
  if (hasSupplier && !hasCustomer) return true;
  if (hasCustomer && !hasSupplier) return false;
  return true;
}

/**
 * Parse a Czech address string into street, city, and postal code.
 */
function parseAddress(address: string | null | undefined): {
  street: string;
  city: string;
  psc: string;
} {
  if (!address) return { street: "", city: "", psc: "" };

  const pscMatch = address.match(/(\d{3}\s?\d{2})/);
  const psc = pscMatch ? pscMatch[1].replace(/\s/g, "") : "";

  const parts = address.split(",").map((p) => p.trim());

  if (parts.length >= 2) {
    const street = parts[0];
    let city = "";
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const cityCandidate = part.replace(/\d{3}\s?\d{2}/, "").trim();
      if (
        cityCandidate &&
        cityCandidate.toLowerCase() !== "czech republic" &&
        cityCandidate.toLowerCase() !== "česká republika" &&
        cityCandidate.toLowerCase() !== "slovenská republika" &&
        cityCandidate.toLowerCase() !== "slovakia"
      ) {
        city = cityCandidate;
        break;
      }
    }
    return { street, city, psc };
  }

  return { street: address, city: "", psc };
}

function generateInvoice(doc: Document): {
  xml: string;
  received: boolean;
} {
  const data = doc.extracted_data;
  if (!data) return { xml: "", received: true };

  const received = isReceivedInvoice(data);
  const tag = received ? "FaktPrij" : "FaktVyd";

  const items = data.items && data.items.length > 0 ? data.items : null;
  const vatRate = data.vat_rate ?? 21;

  // Build items XML
  let polozkyXml = "";
  if (items) {
    const polozky = items
      .map((item, index) => {
        const qty = item.quantity ?? 1;
        const unitPrice = item.unit_price ?? 0;
        const total = item.total ?? qty * unitPrice;
        const base = total / (1 + vatRate / 100);
        const vat = total - base;
        return `        <Polozka>
          <Popis>${escapeXml(item.description)}</Popis>
          <PocetMJ>${formatNumber(qty)}</PocetMJ>
          <SazbaDPH>${vatRate}</SazbaDPH>
          <Cena>${formatNumber(unitPrice)}</Cena>
          <SouhrnDPH>
            <Zaklad>${formatNumber(base)}</Zaklad>
            <DPH>${formatNumber(vat)}</DPH>
          </SouhrnDPH>
          <Poradi>${index + 1}</Poradi>
        </Polozka>`;
      })
      .join("\n");
    polozkyXml = `      <SeznamPolozek>\n${polozky}\n      </SeznamPolozek>`;
  } else {
    const total = data.total_amount ?? 0;
    const vatBase = data.vat_base ?? total / (1 + vatRate / 100);
    const vatAmount = data.vat_amount ?? total - vatBase;
    polozkyXml = `      <SeznamPolozek>
        <Polozka>
          <Popis>${escapeXml(data.notes || "Souhrnná položka")}</Popis>
          <PocetMJ>1.00</PocetMJ>
          <SazbaDPH>${vatRate}</SazbaDPH>
          <Cena>${formatNumber(vatBase)}</Cena>
          <SouhrnDPH>
            <Zaklad>${formatNumber(vatBase)}</Zaklad>
            <DPH>${formatNumber(vatAmount)}</DPH>
          </SouhrnDPH>
          <Poradi>1</Poradi>
        </Polozka>
      </SeznamPolozek>`;
  }

  // Partner info (DodOdb) - uses FaktNazev and FaktAdresa per Money S3 schema
  const firma = received ? data.supplier : data.customer;
  const addr = parseAddress(firma?.address);

  // VAT summary at document level
  const vatBase = data.vat_base ?? 0;
  const vatAmount = data.vat_amount ?? 0;
  const totalAmount = data.total_amount ?? 0;

  // Element order MUST match Money S3 XSD xs:sequence exactly
  const xml = `    <${tag}>
      <Doklad>${escapeXml(data.invoice_number)}</Doklad>
      <Popis>${escapeXml(data.notes || `Faktura ${data.invoice_number || ""}`.trim())}</Popis>
      <Vystaveno>${formatDate(data.issue_date)}</Vystaveno>
      <DatUcPr>${formatDate(data.issue_date)}</DatUcPr>
      <PlnenoDPH>${formatDate(data.issue_date)}</PlnenoDPH>
      <Splatno>${formatDate(data.due_date)}</Splatno>
      <VarSymbol>${escapeXml(data.variable_symbol)}</VarSymbol>
      <ZpVypDPH>0</ZpVypDPH>
      <SazbaDPH1>${vatRate}</SazbaDPH1>
      <SazbaDPH2>12</SazbaDPH2>
      <Proplatit>${formatNumber(totalAmount)}</Proplatit>
      <SouhrnDPH>
        <Zaklad0>0.00</Zaklad0>
        <Zaklad5>0.00</Zaklad5>
        <DPH5>0.00</DPH5>
        <Zaklad22>${formatNumber(vatBase)}</Zaklad22>
        <DPH22>${formatNumber(vatAmount)}</DPH22>
      </SouhrnDPH>
      <Celkem>${formatNumber(totalAmount)}</Celkem>
      <DodOdb>
        <FaktNazev>${escapeXml(firma?.name)}</FaktNazev>
        <ICO>${escapeXml(firma?.ico)}</ICO>
        <DIC>${escapeXml(firma?.dic)}</DIC>
        <FaktAdresa>
          <Ulice>${escapeXml(addr.street)}</Ulice>
          <Misto>${escapeXml(addr.city)}</Misto>
          <PSC>${escapeXml(addr.psc)}</PSC>
        </FaktAdresa>
      </DodOdb>
${polozkyXml}
    </${tag}>`;

  return { xml, received };
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

  const results = filtered.map((doc) => generateInvoice(doc));

  const receivedInvoices = results
    .filter((r) => r.received && r.xml)
    .map((r) => r.xml)
    .join("\n");
  const issuedInvoices = results
    .filter((r) => !r.received && r.xml)
    .map((r) => r.xml)
    .join("\n");

  let seznamy = "";
  if (receivedInvoices) {
    seznamy += `  <SeznamFaktPrij>\n${receivedInvoices}\n  </SeznamFaktPrij>\n`;
  }
  if (issuedInvoices) {
    seznamy += `  <SeznamFaktVyd>\n${issuedInvoices}\n  </SeznamFaktVyd>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<MoneyData JazykVerze="CZ">
${seznamy}</MoneyData>`;
}

export function encodeToWindows1250(xmlString: string): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const iconv = require("iconv-lite") as typeof import("iconv-lite");
  return iconv.encode(xmlString, "win1250");
}
