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
