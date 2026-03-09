export interface AresSubject {
  ico: string;
  name: string;
  dic: string | null;
  address: string;
  city: string;
  zip: string;
}

/**
 * Normalize IČO to 8 digits (pad with leading zeros).
 * Returns null if the input is not 6-8 digits.
 */
export function normalizeIco(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(trimmed)) return null;
  return trimmed.padStart(8, "0");
}

/**
 * Look up a Czech business entity by IČO using the ARES REST API.
 * Returns null if the entity is not found or if there's an error.
 */
export async function lookupIco(ico: string): Promise<AresSubject | null> {
  const normalized = normalizeIco(ico);
  if (!normalized) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${normalized}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    );

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();

    const sidlo = data.sidlo || {};
    const psc = sidlo.psc ? String(sidlo.psc) : "";
    // Format PSČ as "XXX XX" if 5 digits
    const formattedZip =
      psc.length === 5 ? `${psc.slice(0, 3)} ${psc.slice(3)}` : psc;

    return {
      ico: data.ico || normalized,
      name: data.obchodniJmeno || "",
      dic: data.dic || null,
      address: sidlo.textovaAdresa || "",
      city: sidlo.nazevObce || "",
      zip: formattedZip,
    };
  } catch {
    return null;
  }
}
