import type { NextApiRequest, NextApiResponse } from "next"

function env(name: string) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function mintIntegrationToken() {
  const tokenEndpoint = "https://auth.commercelayer.io/oauth/token"

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env("CL_INT_CLIENT_ID"),
    client_secret: env("CL_INT_CLIENT_SECRET"),
  })

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  })

  const text = await res.text().catch(() => "")
  if (!res.ok) {
    throw new Error(
      `[integration] token error: ${res.status} ${text.slice(0, 300)}`,
    )
  }

  const json = JSON.parse(text)
  if (!json?.access_token)
    throw new Error("[integration] token missing access_token")
  return json.access_token as string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "method_not_allowed" })
  }

  try {
    const orderId = String(req.query.orderId || "").trim()
    if (!orderId) {
      return res.status(400).json({ ok: false, error: "missing_order_id" })
    }

    const accessToken = await mintIntegrationToken()
    const organization = env("CL_ORGANIZATION")
    const base = `https://${organization}.commercelayer.io/api`

    const refreshRes = await fetch(`${base}/orders/${orderId}/_refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
    })

    const refreshText = await refreshRes.text().catch(() => "")

    if (!refreshRes.ok) {
      return res.status(500).json({
        ok: false,
        error: "refresh_failed",
        status: refreshRes.status,
        body: refreshText.slice(0, 500),
      })
    }

    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message ?? String(e),
    })
  }
}
