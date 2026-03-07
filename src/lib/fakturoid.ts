import { createServiceRoleClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";

interface FakturoidCredentials {
  slug: string;
  clientId: string;
  clientSecret: string;
}

// Per-user token cache: userId -> token info
const tokenCache = new Map<
  string,
  { access_token: string; expires_at: number }
>();

/**
 * Load Fakturoid credentials for a given user from user_integrations table.
 * Falls back to ENV variables if no per-user integration is configured.
 */
export async function getFakturoidCredentials(
  userId: string
): Promise<FakturoidCredentials> {
  const supabase = createServiceRoleClient();

  const { data: integration } = await supabase
    .from("user_integrations")
    .select("slug, client_id, client_secret_encrypted")
    .eq("user_id", userId)
    .eq("provider", "fakturoid")
    .single();

  if (integration && integration.client_secret_encrypted) {
    return {
      slug: integration.slug,
      clientId: integration.client_id,
      clientSecret: decrypt(integration.client_secret_encrypted),
    };
  }

  // Fallback to environment variables
  const clientId = process.env.FAKTUROID_CLIENT_ID;
  const clientSecret = process.env.FAKTUROID_CLIENT_SECRET;
  const slug = process.env.FAKTUROID_ACCOUNT_SLUG;

  if (!clientId || !clientSecret || !slug) {
    throw new Error(
      "Fakturoid není nakonfigurován. Přejdi do Nastavení → Integrace."
    );
  }

  return { slug, clientId, clientSecret };
}

export async function getFakturoidAccessToken(
  userId: string
): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  const cached = tokenCache.get(userId);
  if (cached && Date.now() < cached.expires_at - 60_000) {
    return cached.access_token;
  }

  const { clientId, clientSecret } = await getFakturoidCredentials(userId);

  const response = await fetch(
    "https://app.fakturoid.cz/api/v3/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization:
          "Basic " +
          Buffer.from(clientId + ":" + clientSecret).toString("base64"),
        "User-Agent": "DokladyAI (support@doklady.ai)",
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    }
  );

  const responseBody = await response.text();
  console.log("[Fakturoid OAuth] Status:", response.status);

  if (!response.ok) {
    throw new Error(
      `Fakturoid OAuth failed (${response.status}): ${responseBody}`
    );
  }

  const data = JSON.parse(responseBody);

  tokenCache.set(userId, {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

const FAKTUROID_BASE = "https://app.fakturoid.cz/api/v3/accounts";
const HEADERS_BASE = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "DokladyAI (support@doklady.ai)",
};

async function fakturoidHeaders(
  userId: string
): Promise<Record<string, string>> {
  const token = await getFakturoidAccessToken(userId);
  return { ...HEADERS_BASE, Authorization: `Bearer ${token}` };
}

/**
 * Search for an existing subject by IČO (registration_no).
 * Returns the subject object if found, or null.
 */
export async function findSubjectByIco(
  accountSlug: string,
  ico: string,
  userId: string
): Promise<{ id: number } | null> {
  const headers = await fakturoidHeaders(userId);
  const url = `${FAKTUROID_BASE}/${accountSlug}/subjects.json?registration_no=${encodeURIComponent(ico)}`;

  const response = await fetch(url, { headers });
  const body = await response.text();
  console.log("[Fakturoid] Search subject status:", response.status);

  if (!response.ok) return null;

  const subjects = JSON.parse(body);
  if (Array.isArray(subjects) && subjects.length > 0) {
    console.log(
      "[Fakturoid DEBUG] Subjects returned for IČO",
      ico,
      "- count:",
      subjects.length
    );
    subjects.forEach(
      (
        s: { id: number; name?: string; registration_no?: string },
        i: number
      ) => {
        console.log(
          `[Fakturoid DEBUG]   subject[${i}]: id=${s.id}, name="${s.name}", registration_no="${s.registration_no}"`
        );
      }
    );

    // Fakturoid API may return unrelated subjects — filter by exact IČO match
    const exactMatch = subjects.find(
      (s: { registration_no?: string }) => s.registration_no === ico
    );
    if (exactMatch) {
      console.log(
        "[Fakturoid DEBUG] Exact IČO match found: id=",
        exactMatch.id,
        "name=",
        exactMatch.name
      );
      return exactMatch;
    }
    console.log(
      "[Fakturoid DEBUG] No exact IČO match among returned subjects — will create new"
    );
    return null;
  }
  console.log("[Fakturoid DEBUG] No subjects found for IČO:", ico);
  return null;
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
  },
  userId: string
): Promise<{ id: number }> {
  const headers = await fakturoidHeaders(userId);
  const payload: Record<string, string> = {
    name: subject.name,
    type: "supplier",
  };
  if (subject.registration_no)
    payload.registration_no = subject.registration_no;
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

  if (!response.ok) {
    throw new Error(`Failed to create subject (${response.status}): ${body}`);
  }

  return JSON.parse(body);
}
