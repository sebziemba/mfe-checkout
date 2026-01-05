import type { NextApiRequest, NextApiResponse } from "next"

function env(name: string) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false })

    const tokenEndpoint = "https://auth.commercelayer.io/oauth/token"
    const clientId = env("CL_SC_CLIENT_ID")
    const clientSecret = env("CL_SC_CLIENT_SECRET")

    // IMPORTANT:
    // Sales channel tokens are requested using client_credentials.
    // (We are NOT adding market scope here because in your org it caused scope auth failures.
    // The MFE can still access the order if the sales channel role allows it.)
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      // If later you confirm scope is allowed, you can add:
      // scope: `market:${process.env.CL_MARKET_ID}`
    })

    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization:
          "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body,
      cache: "no-store",
    })

    const text = await r.text().catch(() => "")
    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: `Token error: ${r.status}`,
        bodyFirst300: text.slice(0, 300),
      })
    }

    const json = JSON.parse(text)
    if (!json?.access_token) {
      return res.status(500).json({ ok: false, error: "missing_access_token" })
    }

    return res.status(200).json({ ok: true, accessToken: json.access_token })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server_error" })
  }
}
