import type { NextApiRequest, NextApiResponse } from "next"

function env(name: string) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function clApiBase() {
  const slug =
    process.env.CL_SLUG?.trim() || process.env.CL_ORGANIZATION?.trim() || ""
  if (!slug)
    throw new Error("Missing env: CL_SLUG (or CL_ORGANIZATION as slug)")
  return { slug, base: `https://${slug}.commercelayer.io/api` }
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
      `[integration] token error: ${res.status} ${text.slice(0, 800)}`,
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
  // Always return JSON (so Network tab is useful)
  res.setHeader("Content-Type", "application/json; charset=utf-8")

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "method_not_allowed" })
  }

  const orderId = String(req.query.orderId || "").trim()

  try {
    if (!orderId) {
      return res.status(400).json({ ok: false, error: "missing_order_id" })
    }

    const { slug, base } = clApiBase()
    console.log("[refresh] using org slug:", slug)
    console.log("[refresh] base:", base)
    console.log("[refresh] orderId:", orderId)

    const accessToken = await mintIntegrationToken()
    console.log("[refresh] integration token ok", accessToken.slice(0, 12))

    // 1) refresh
    const refresh = await clFetch(
      `${base}/orders/${orderId}/_refresh`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    )

    // 2) fetch with includes
    const include = [
      "market",
      "line_items",
      "shipments",
      "shipments.stock_transfers",
      "shipments.available_shipping_methods",
      "shipments.shipping_method",
      "shipments.stock_location",
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
      slug,
      refreshOk: refresh.ok,
      refreshStatus: refresh.status,
      refreshBodyPreview: refresh.ok
        ? null
        : (refresh.json ?? refresh.text.slice(0, 800)),
      orderFetchOk: order.ok,
      orderFetchStatus: order.status,
      orderBodyPreview: order.ok
        ? null
        : (order.json ?? order.text.slice(0, 800)),
      shipmentsCount: shipments.length,
      stockTransfersCount: stockTransfers.length,
      shippingMethodsCount: shippingMethods.length,
    }

    // If refresh failed, surface exactly why.
    if (!refresh.ok) {
      return res.status(500).json({
        ok: false,
        error: "refresh_failed",
        debug,
      })
    }

    // If fetch failed, surface exactly why.
    if (!order.ok) {
      return res.status(500).json({
        ok: false,
        error: "order_fetch_failed",
        debug,
      })
    }

    return res.status(200).json({ ok: true, debug })
  } catch (e: any) {
    console.error("[refresh] server_error", e)
    return res.status(500).json({
      ok: false,
      error: "server_error",
      orderId,
      message: e?.message ?? String(e),
    })
  }
}
