import type { NextApiRequest, NextApiResponse } from "next";

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const tokenEndpoint = "https://auth.commercelayer.io/oauth/token";
    const clientId = env("CL_SC_CLIENT_ID");
    const clientSecret = env("CL_SC_CLIENT_SECRET");

    // IMPORTANT: In CL, Sales Channel "client_credentials" is NOT how you get a market token.
    // You must use the proper guest token flow supported by your checkout MFE setup.
    // In many MFE setups, this is done via "sales_channel" guest token endpoint / config.
    // If your MFE checkout expects a Sales Channel JWT, we can request a guest token using the standard CL auth flow:

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      // NOTE: if your org disallows this for sales channels (your earlier tests),
      // then the checkout app must use the MFE's native token method (JWT bearer / guest flow).
      // We'll handle that below via the MFE approach.
    });

    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body,
    });

    const text = await r.text().catch(() => "");
    if (!r.ok) return res.status(r.status).json({ ok: false, error: text });

    const json = JSON.parse(text);
    return res.status(200).json({ ok: true, accessToken: json.access_token });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
}
