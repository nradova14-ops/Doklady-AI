let cachedToken: { access_token: string; expires_at: number } | null = null;

export async function getFakturoidAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const clientId = process.env.FAKTUROID_CLIENT_ID;
  const clientSecret = process.env.FAKTUROID_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("FAKTUROID_CLIENT_ID and FAKTUROID_CLIENT_SECRET must be set");
  }

  const response = await fetch(
    "https://app.fakturoid.cz/api/v3/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
        "User-Agent": "DokladyAI (support@doklady.ai)",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    }
  );

  const responseBody = await response.text();
  console.log("[Fakturoid OAuth] Status:", response.status);
  console.log("[Fakturoid OAuth] Response body:", responseBody);

  if (!response.ok) {
    throw new Error(
      `Fakturoid OAuth failed (${response.status}): ${responseBody}`
    );
  }

  const data = JSON.parse(responseBody);

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.access_token;
}

const FAKTUROID_BASE = "https://app.fakturoid.cz/api/v3/accounts";
const HEADERS_BASE = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "DokladyAI (support@doklady.ai)",
};

async function fakturoidHeaders(): Promise<Record<string, string>> {
  const token = await getFakturoidAccessToken();
  return { ...HEADERS_BASE, Authorization: `Bearer ${token}` };
}

/**
 * Search for an existing subject by IČO (registration_no).
 * Returns the subject object if found, or null.
 */
export async function findSubjectByIco(
  accountSlug: string,
  ico: string
): Promise<{ id: number } | null> {
  const headers = await fakturoidHeaders();
  const url = `${FAKTUROID_BASE}/${accountSlug}/subjects.json?registration_no=${encodeURIComponent(ico)}`;

  const response = await fetch(url, { headers });
  const body = await response.text();
  console.log("[Fakturoid] Search subject status:", response.status);
  console.log("[Fakturoid] Search subject response:", body);

  if (!response.ok) return null;

  const subjects = JSON.parse(body);
  return Array.isArray(subjects) && subjects.length > 0 ? subjects[0] : null;
}

/**
 * Create a new subject (contact) in Fakturoid.
 * Returns the created subject object with its id.
 */
export async function createSubject(
  accountSlug: string,
  subject: {
    name: string;
    registration_no?: string;
    vat_no?: string;
    street?: string;
  }
): Promise<{ id: number }> {
  const headers = await fakturoidHeaders();
  const payload: Record<string, string> = {
    name: subject.name,
    type: "supplier",
  };
  if (subject.registration_no) payload.registration_no = subject.registration_no;
  if (subject.vat_no) payload.vat_no = subject.vat_no;
  if (subject.street) payload.street = subject.street;

  const response = await fetch(
    `${FAKTUROID_BASE}/${accountSlug}/subjects.json`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );

  const body = await response.text();
  console.log("[Fakturoid] Create subject status:", response.status);
  console.log("[Fakturoid] Create subject response:", body);

  if (!response.ok) {
    throw new Error(`Failed to create subject (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}
