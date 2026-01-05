// pages/api/guest-token.ts (or app/api/guest-token/route.ts depending on your app)
import type { NextApiRequest, NextApiResponse } from "next"

function env(name: string) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const tokenEndpoint = "https://auth.commercelayer.io/oauth/token"

    const clientId = env("CL_SC_CLIENT_ID")
    const clientSecret = env("CL_SC_CLIENT_SECRET")

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "market:all",
    })

    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })

    const text = await r.text()
    if (!r.ok) return res.status(r.status).json({ ok: false, error: text })

    const json = JSON.parse(text)
    return res.status(200).json({ ok: true, accessToken: json.access_token })
  } catch (e: any) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "server_error" })
  }
}
