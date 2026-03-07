import type { Document, ExtractedData } from "@/types/database";
import { randomUUID } from "crypto";

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
  if (!dateStr) return new Date().toISOString().split("T")[0];
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return dateStr;
}

/**
 * Parse a Czech address string into street, city, and postal code.
 */
function parseAddress(address: string | null | undefined): {
  street: string;
  city: string;
  postalZone: string;
} {
  if (!address) return { street: "", city: "", postalZone: "" };

  const pscMatch = address.match(/(\d{3})\s?(\d{2})/);
  const postalZone = pscMatch ? `${pscMatch[1]}${pscMatch[2]}` : "";

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
    return { street, city, postalZone };
  }

  return { street: address, city: "", postalZone };
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
 * Map document type to ISDOC DocumentType code:
 * 1 = Faktura (Invoice)
 * 2 = Dobropis (Credit Note)
 * 3 = Vrubopis (Debit Note)
 * 5 = Zálohová faktura (Advance Invoice)
 * 6 = Přijatá faktura (Received Invoice) — not a standard ISDOC code,
 *     ISDOC uses type 1 for both; the direction is determined by party roles.
 */
function getDocumentType(data: ExtractedData): number {
  const docType = (data.document_type || "").toLowerCase();
  if (docType.includes("dobropis") || docType.includes("credit")) return 2;
  if (docType.includes("vrubopis") || docType.includes("debit")) return 3;
  if (docType.includes("záloh") || docType.includes("zaloh") || docType.includes("advance")) return 5;
  return 1;
}

function generatePartyXml(
  tagName: string,
  party: { name: string | null; ico: string | null; dic: string | null; address: string | null } | undefined
): string {
  if (!party) {
    return `  <${tagName}>
    <Party>
      <PartyIdentification><ID></ID></PartyIdentification>
      <PartyName><Name></Name></PartyName>
      <PostalAddress>
        <StreetName></StreetName>
        <CityName></CityName>
        <PostalZone></PostalZone>
        <Country>
          <IdentificationCode>CZ</IdentificationCode>
          <Name>Česká republika</Name>
        </Country>
      </PostalAddress>
    </Party>
  </${tagName}>`;
  }

  const addr = parseAddress(party.address);
  const taxScheme = party.dic
    ? `
      <PartyTaxScheme>
        <CompanyID>${escapeXml(party.dic)}</CompanyID>
        <TaxScheme>VAT</TaxScheme>
      </PartyTaxScheme>`
    : "";

  return `  <${tagName}>
    <Party>
      <PartyIdentification><ID>${escapeXml(party.ico)}</ID></PartyIdentification>
      <PartyName><Name>${escapeXml(party.name)}</Name></PartyName>
      <PostalAddress>
        <StreetName>${escapeXml(addr.street)}</StreetName>
        <CityName>${escapeXml(addr.city)}</CityName>
        <PostalZone>${escapeXml(addr.postalZone)}</PostalZone>
        <Country>
          <IdentificationCode>CZ</IdentificationCode>
          <Name>Česká republika</Name>
        </Country>
      </PostalAddress>${taxScheme}
    </Party>
  </${tagName}>`;
}

/**
 * Generate a single ISDOC XML document for one invoice.
 * Conforms to ISDOC 6.0.1 schema (http://isdoc.cz/namespace/2013).
 * Note: Digital signature is not included — most accounting software
 * accepts unsigned ISDOC for import purposes.
 */
export function generateIsdocXml(doc: Document): string | null {
  const data = doc.extracted_data;
  if (!data) return null;

  const received = isReceivedInvoice(data);
  const documentType = getDocumentType(data);
  const uuid = randomUUID();
  const issueDate = formatDate(data.issue_date);
  const dueDate = formatDate(data.due_date);
  const currency = data.currency || "CZK";
  const vatRate = data.vat_rate ?? 21;
  const totalAmount = data.total_amount ?? 0;

  // Supplier is always AccountingSupplierParty, Customer is AccountingCustomerParty
  // For received invoices, the supplier is the other party (dodavatel)
  // For issued invoices, the supplier is us (we issued it)
  const supplierParty = generatePartyXml("AccountingSupplierParty", data.supplier);
  const customerParty = generatePartyXml("AccountingCustomerParty", data.customer);

  // Build invoice lines
  const items = data.items && data.items.length > 0 ? data.items : null;
  let invoiceLinesXml = "";
  let taxableTotal = 0;
  let vatTotal = 0;

  if (items) {
    const lines = items.map((item, index) => {
      const qty = item.quantity ?? 1;
      const unitPrice = item.unit_price ?? 0;
      const lineTotal = item.total ?? qty * unitPrice;
      const base = Math.round((lineTotal / (1 + vatRate / 100)) * 100) / 100;
      const vat = Math.round((lineTotal - base) * 100) / 100;
      taxableTotal += base;
      vatTotal += vat;

      return `    <InvoiceLine>
      <ID>${index + 1}</ID>
      <InvoicedQuantity unitCode="KS">${formatNumber(qty)}</InvoicedQuantity>
      <LineExtensionAmount>${formatNumber(base)}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${formatNumber(lineTotal)}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>${formatNumber(vat)}</LineExtensionTaxAmount>
      <UnitPrice>${formatNumber(unitPrice)}</UnitPrice>
      <UnitPriceTaxInclusive>${formatNumber(Math.round(unitPrice * (1 + vatRate / 100) * 100) / 100)}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>${vatRate}</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
      </ClassifiedTaxCategory>
      <Item>
        <Description>${escapeXml(item.description)}</Description>
      </Item>
    </InvoiceLine>`;
    });
    invoiceLinesXml = lines.join("\n");
  } else {
    // Single summary line
    const vatBase = data.vat_base ?? Math.round((totalAmount / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = data.vat_amount ?? Math.round((totalAmount - vatBase) * 100) / 100;
    taxableTotal = vatBase;
    vatTotal = vatAmount;

    invoiceLinesXml = `    <InvoiceLine>
      <ID>1</ID>
      <InvoicedQuantity unitCode="KS">1.00</InvoicedQuantity>
      <LineExtensionAmount>${formatNumber(vatBase)}</LineExtensionAmount>
      <LineExtensionAmountTaxInclusive>${formatNumber(totalAmount)}</LineExtensionAmountTaxInclusive>
      <LineExtensionTaxAmount>${formatNumber(vatAmount)}</LineExtensionTaxAmount>
      <UnitPrice>${formatNumber(vatBase)}</UnitPrice>
      <UnitPriceTaxInclusive>${formatNumber(totalAmount)}</UnitPriceTaxInclusive>
      <ClassifiedTaxCategory>
        <Percent>${vatRate}</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
      </ClassifiedTaxCategory>
      <Item>
        <Description>${escapeXml(data.notes || "Souhrnná položka")}</Description>
      </Item>
    </InvoiceLine>`;
  }

  // Round totals
  taxableTotal = Math.round(taxableTotal * 100) / 100;
  vatTotal = Math.round(vatTotal * 100) / 100;
  const inclusiveTotal = Math.round((taxableTotal + vatTotal) * 100) / 100;

  // Payment means
  let paymentMeansXml = "";
  if (data.bank_account || data.variable_symbol) {
    // Parse bank account (format: "123456789/0800" or just account number)
    const bankParts = (data.bank_account || "").split("/");
    const accountId = bankParts[0] || "";
    const bankCode = bankParts[1] || "";

    paymentMeansXml = `  <PaymentMeans>
    <Payment>
      <PaidAmount>${formatNumber(inclusiveTotal)}</PaidAmount>
      <PaymentMeansCode>42</PaymentMeansCode>
      <Details>
        <PaymentDueDate>${dueDate}</PaymentDueDate>${accountId ? `
        <ID>${escapeXml(accountId)}</ID>` : ""}${bankCode ? `
        <BankCode>${escapeXml(bankCode)}</BankCode>` : ""}${data.variable_symbol ? `
        <VariableSymbol>${escapeXml(data.variable_symbol)}</VariableSymbol>` : ""}
      </Details>
    </Payment>
  </PaymentMeans>`;
  }

  // Note about direction for import
  const directionNote = received ? "Přijatá faktura" : "Vydaná faktura";
  const noteText = data.notes ? `${directionNote} - ${data.notes}` : directionNote;

  return `<?xml version="1.0" encoding="utf-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
  <DocumentType>${documentType}</DocumentType>
  <ID>${escapeXml(data.invoice_number || "")}</ID>
  <UUID>${uuid}</UUID>
  <IssueDate>${issueDate}</IssueDate>
  <DueDate>${dueDate}</DueDate>
  <TaxPointDate>${issueDate}</TaxPointDate>
  <Note>${escapeXml(noteText)}</Note>
  <LocalCurrencyCode>${escapeXml(currency)}</LocalCurrencyCode>
  <CurrRate>1</CurrRate>
  <RefCurrRate>1</RefCurrRate>
${supplierParty}
${customerParty}
  <InvoiceLines>
${invoiceLinesXml}
  </InvoiceLines>
  <TaxTotal>
    <TaxSubTotal>
      <TaxableAmount>${formatNumber(taxableTotal)}</TaxableAmount>
      <TaxAmount>${formatNumber(vatTotal)}</TaxAmount>
      <TaxInclusiveAmount>${formatNumber(inclusiveTotal)}</TaxInclusiveAmount>
      <AlreadyClaimedTaxableAmount>0</AlreadyClaimedTaxableAmount>
      <AlreadyClaimedTaxAmount>0</AlreadyClaimedTaxAmount>
      <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
      <DifferenceTaxableAmount>${formatNumber(taxableTotal)}</DifferenceTaxableAmount>
      <DifferenceTaxAmount>${formatNumber(vatTotal)}</DifferenceTaxAmount>
      <DifferenceTaxInclusiveAmount>${formatNumber(inclusiveTotal)}</DifferenceTaxInclusiveAmount>
      <TaxCategory>
        <Percent>${vatRate}</Percent>
        <VATCalculationMethod>0</VATCalculationMethod>
      </TaxCategory>
    </TaxSubTotal>
    <TaxAmount>${formatNumber(vatTotal)}</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <TaxExclusiveAmount>${formatNumber(taxableTotal)}</TaxExclusiveAmount>
    <TaxInclusiveAmount>${formatNumber(inclusiveTotal)}</TaxInclusiveAmount>
    <AlreadyClaimedTaxExclusiveAmount>0</AlreadyClaimedTaxExclusiveAmount>
    <AlreadyClaimedTaxInclusiveAmount>0</AlreadyClaimedTaxInclusiveAmount>
    <DifferenceTaxExclusiveAmount>${formatNumber(taxableTotal)}</DifferenceTaxExclusiveAmount>
    <DifferenceTaxInclusiveAmount>${formatNumber(inclusiveTotal)}</DifferenceTaxInclusiveAmount>
    <PayableRoundingAmount>0</PayableRoundingAmount>
    <PaidDepositsAmount>0</PaidDepositsAmount>
    <PayableAmount>${formatNumber(inclusiveTotal)}</PayableAmount>
  </LegalMonetaryTotal>
${paymentMeansXml}
</Invoice>`;
}

export type ExportType = "received" | "issued" | "all";

/**
 * Filter documents by type (received/issued/all).
 */
export function filterDocuments(documents: Document[], type: ExportType): Document[] {
  return documents.filter((doc) => {
    if (!doc.extracted_data) return false;
    if (type === "all") return true;
    const received = isReceivedInvoice(doc.extracted_data);
    return type === "received" ? received : !received;
  });
}
