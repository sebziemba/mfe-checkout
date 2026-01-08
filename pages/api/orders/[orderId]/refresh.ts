import type { NextApiRequest, NextApiResponse } from "next"

function env(name: string) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function clApiBase() {
  const slug = env("CL_ORGANIZATION") // you said CL_ORGANIZATION == CL_SLUG, fine
  return `https://${slug}.commercelayer.io/api`
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
    cache: "no-store",
  })

  const text = await res.text().catch(() => "")
  if (!res.ok) {
    throw new Error(
      `[integration] token error: ${res.status} ${text.slice(0, 500)}`,
    )
  }

  const json = JSON.parse(text)
  if (!json?.access_token)
    throw new Error("[integration] token missing access_token")
  return json.access_token as string
}

async function clFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  const text = await res.text().catch(() => "")
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return { ok: res.ok, status: res.status, text, json }
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
    if (!orderId)
      return res.status(400).json({ ok: false, error: "missing_order_id" })

    const accessToken = await mintIntegrationToken()
    const base = clApiBase()

    // 1) Refresh
    const refresh = await clFetch(
      `${base}/orders/${orderId}/_refresh`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    )

    // 2) Re-fetch with includes
    const include = [
      "market",
      "line_items",
      "shipments",
      "shipments.stock_transfers",
      "shipments.available_shipping_methods",
      "shipments.shipping_method",
    ].join(",")

    const order = await clFetch(
      `${base}/orders/${orderId}?include=${encodeURIComponent(include)}`,
      accessToken,
      { method: "GET" },
    )

    const included: any[] = Array.isArray(order.json?.included)
      ? order.json.included
      : []
    const shipments = included.filter((r) => r?.type === "shipments")
    const stockTransfers = included.filter((r) => r?.type === "stock_transfers")
    const shippingMethods = included.filter(
      (r) => r?.type === "shipping_methods",
    )

    const debug = {
      refreshOk: refresh.ok,
      refreshStatus: refresh.status,
      orderFetchOk: order.ok,
      orderFetchStatus: order.status,
      shipmentsCount: shipments.length,
      stockTransfersCount: stockTransfers.length,
      shippingMethodsCount: shippingMethods.length,
    }

    console.log("[orders/refresh]", { orderId, debug })

    if (!refresh.ok) {
      return res.status(500).json({
        ok: false,
        error: "refresh_failed",
        debug,
        refreshBody: refresh.json ?? refresh.text.slice(0, 1500),
      })
    }

    return res.status(200).json({
      ok: true,
      debug,
    })
  } catch (e: any) {
    console.error("[orders/refresh] server_error", e)
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message ?? String(e),
    })
  }
}
