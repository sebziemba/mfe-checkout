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
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "method_not_allowed" })

  try {
    const tokenEndpoint = "https://auth.commercelayer.io/oauth/token"

    // Sales Channel credentials FROM CHECKOUT APP Vercel env
    const clientId = env("CL_SC_CLIENT_ID")
    const clientSecret = env("CL_SC_CLIENT_SECRET")

    // Use market:all because that’s what your auth server accepts in your tests
    const scope = "market:all"

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    })

    const r = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    })

    const text = await r.text()
    if (!r.ok) {
      return res
        .status(500)
        .json({ ok: false, error: "token_error", details: text.slice(0, 300) })
    }

    const j = JSON.parse(text)
    if (!j?.access_token)
      return res.status(500).json({ ok: false, error: "token_missing" })

    return res.status(200).json({ ok: true, accessToken: j.access_token })
  } catch (e: any) {
    return res
      .status(500)
      .json({
        ok: false,
        error: "server_error",
        message: e?.message || String(e),
      })
  }
}
