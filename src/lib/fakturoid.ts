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
        "User-Agent": "DokladyAI (support@doklady.ai)",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Fakturoid OAuth failed (${response.status}): ${body}`
    );
  }

  const data = await response.json();

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.access_token;
}
