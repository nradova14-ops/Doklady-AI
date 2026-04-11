import { createServiceRoleClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

interface IdokladCredentials {
  clientId: string;
  clientSecret: string;
}

const IDOKLAD_TOKEN_URL =
  "https://identity.idoklad.cz/server/connect/token";
export const IDOKLAD_API_BASE = "https://api.idoklad.cz/v3";

/**
 * Load iDoklad credentials for a given user from user_integrations table.
 */
export async function getIdokladCredentials(
  userId: string
): Promise<IdokladCredentials> {
  const supabase = createServiceRoleClient();

  const { data: integration } = await supabase
    .from("user_integrations")
    .select("client_id, client_secret_encrypted")
    .eq("user_id", userId)
    .eq("provider", "idoklad")
    .single();

  if (integration && integration.client_secret_encrypted) {
    return {
      clientId: integration.client_id,
      clientSecret: decrypt(integration.client_secret_encrypted),
    };
  }

  throw new Error(
    "iDoklad není nakonfigurován. Přejděte do Nastavení → Integrace."
  );
}

/**
 * Obtain an access token via Client Credentials flow.
 */
export async function getIdokladToken(
  credentials: IdokladCredentials
): Promise<string> {
  const response = await fetch(IDOKLAD_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: "idoklad_api",
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `iDoklad OAuth failed (${response.status}): ${body}`
    );
  }

  const data = JSON.parse(body);
  return data.access_token;
}

/**
 * Obtain a token for the given user (fetches credentials from DB).
 */
async function getTokenForUser(userId: string): Promise<string> {
  const creds = await getIdokladCredentials(userId);
  return getIdokladToken(creds);
}

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

interface IdokladContact {
  Id: number;
  CompanyName: string;
  IdentificationNumber?: string;
}

/**
 * Search for a contact by IČO.
 */
export async function findContactByIco(
  token: string,
  ico: string
): Promise<IdokladContact | null> {
  const url = `${IDOKLAD_API_BASE}/Contacts?filter=IdentificationNumber~eq~'${ico}'`;
  const response = await fetch(url, { headers: apiHeaders(token) });

  if (!response.ok) return null;

  const data = await response.json();
  const items = data.Items || data;

  if (Array.isArray(items) && items.length > 0) {
    return items[0];
  }

  return null;
}

/**
 * Create a new contact.
 */
async function createContact(
  token: string,
  supplier: {
    name: string;
    ico?: string;
    dic?: string;
    address?: string;
  }
): Promise<IdokladContact> {
  const payload: Record<string, string> = {
    CompanyName: supplier.name,
  };
  if (supplier.ico) payload.IdentificationNumber = supplier.ico;
  if (supplier.dic) payload.VatIdentificationNumber = supplier.dic;
  if (supplier.address) payload.Street = supplier.address;

  const response = await fetch(`${IDOKLAD_API_BASE}/Contacts`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify(payload),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Failed to create iDoklad contact (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}

/**
 * Find existing contact by IČO or create a new one.
 * Returns the contact Id.
 */
async function findOrCreateContact(
  token: string,
  supplier: { name?: string | null; ico?: string | null; dic?: string | null; address?: string | null }
): Promise<number> {
  const supplierName = supplier.name || "Neznámý dodavatel";

  if (supplier.ico) {
    const existing = await findContactByIco(token, supplier.ico);
    if (existing) return existing.Id;
  }

  const created = await createContact(token, {
    name: supplierName,
    ico: supplier.ico || undefined,
    dic: supplier.dic || undefined,
    address: supplier.address || undefined,
  });

  return created.Id;
}

/**
 * Map a VAT rate percentage to iDoklad VatRateType.
 */
function vatRateType(rate: number | null | undefined): number {
  if (rate == null || rate === 0) return 2; // zero / exempt
  if (rate === 21) return 0; // basic
  if (rate === 12) return 1; // reduced
  if (rate === 15) return 3; // second reduced
  // Default to basic for unknown rates
  return 0;
}

/**
 * Format a date string to ISO 8601 with time component for iDoklad.
 * Input: "2024-01-15" → Output: "2024-01-15T00:00:00"
 */
function toIdokladDate(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  // Already has time component
  if (dateStr.includes("T")) return dateStr;
  return `${dateStr}T00:00:00`;
}

interface ReceivedInvoiceItem {
  Name: string;
  Amount: number;
  Unit: string;
  UnitPrice: number;
  PriceType: number;
  VatRateType: number;
}

/**
 * Main function: send extracted invoice data to iDoklad as a received invoice.
 */
export async function sendToIdoklad(
  userId: string,
  extractedData: Record<string, unknown>
): Promise<{ invoiceId: number; invoiceNumber: string }> {
  const token = await getTokenForUser(userId);

  const data = extractedData as {
    supplier?: { name?: string | null; ico?: string | null; dic?: string | null; address?: string | null };
    document_type?: string | null;
    invoice_number?: string | null;
    variable_symbol?: string | null;
    issue_date?: string | null;
    due_date?: string | null;
    total_amount?: number | null;
    vat_rate?: number | null;
    vat_base?: number | null;
    currency?: string | null;
    items?: { description?: string | null; quantity?: number | null; unit_price?: number | null }[];
  };

  const supplier = data.supplier || {};
  const supplierId = await findOrCreateContact(token, supplier);

  const globalVatRate = data.vat_rate != null ? Number(data.vat_rate) : 21;

  // Build invoice items
  const items: ReceivedInvoiceItem[] = (data.items || []).map((item) => ({
    Name: item.description || "Položka",
    Amount: item.quantity != null ? Number(item.quantity) : 1,
    Unit: "ks",
    UnitPrice:
      item.unit_price != null
        ? Math.round(Number(item.unit_price) * 100) / 100
        : 0,
    PriceType: 0, // without VAT
    VatRateType: vatRateType(globalVatRate),
  }));

  // If no line items, create a single line from totals
  if (items.length === 0 && data.total_amount != null) {
    items.push({
      Name: data.document_type || "Položka",
      Amount: 1,
      Unit: "ks",
      UnitPrice:
        Math.round(Number(data.vat_base ?? data.total_amount) * 100) / 100 || 0,
      PriceType: 0,
      VatRateType: vatRateType(globalVatRate),
    });
  }

  // Add rounding adjustment if needed
  if (data.total_amount != null && items.length > 0) {
    const computedTotal = items.reduce((sum, line) => {
      const lineBase = line.Amount * line.UnitPrice;
      const rate =
        line.VatRateType === 0
          ? 21
          : line.VatRateType === 1
          ? 12
          : line.VatRateType === 3
          ? 15
          : 0;
      const lineVat = Math.round(lineBase * (rate / 100) * 100) / 100;
      return sum + lineBase + lineVat;
    }, 0);
    const invoiceTotal = Number(data.total_amount);
    const roundingDiff = Math.round((invoiceTotal - computedTotal) * 100) / 100;

    if (Math.abs(roundingDiff) > 0.001) {
      items.push({
        Name: "Zaokrouhlení",
        Amount: 1,
        Unit: "ks",
        UnitPrice: roundingDiff,
        PriceType: 0,
        VatRateType: 2, // 0% VAT
      });
    }
  }

  const payload: Record<string, unknown> = {
    SupplierId: supplierId,
    ReceivedInvoiceItems: items,
  };

  if (data.invoice_number) payload.DocumentNumber = data.invoice_number;
  if (data.variable_symbol) payload.VariableSymbol = data.variable_symbol;
  if (data.issue_date) payload.DateOfIssue = toIdokladDate(data.issue_date);
  if (data.due_date) payload.DateOfMaturity = toIdokladDate(data.due_date);
  if (data.issue_date)
    payload.DateOfReceiving = toIdokladDate(data.issue_date);
  if (data.document_type) payload.Description = data.document_type;

  const response = await fetch(`${IDOKLAD_API_BASE}/ReceivedInvoices`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify(payload),
  });

  const responseBody = await response.text();

  if (!response.ok) {
    let errorMsg = `iDoklad API error (${response.status})`;
    try {
      const errData = JSON.parse(responseBody);
      errorMsg = errData.Message || errData.ExceptionMessage || errorMsg;
    } catch {
      // use default message
    }
    throw new Error(errorMsg);
  }

  const invoice = JSON.parse(responseBody);
  return {
    invoiceId: invoice.Id,
    invoiceNumber: invoice.DocumentNumber || String(invoice.Id),
  };
}
