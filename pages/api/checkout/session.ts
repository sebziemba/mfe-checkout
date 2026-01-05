import type { NextApiRequest, NextApiResponse } from "next"
import crypto from "crypto"

// ✅ Minimal in-memory store for local dev only.
// In production use Vercel KV / Upstash Redis / Postgres.
const mem = globalThis as any
mem.__checkoutSessions = mem.__checkoutSessions || new Map<string, { token: string; exp: number }>()
const store: Map<string, { token: string; exp: number }> = mem.__checkoutSessions

function env(name: string) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false })

  // Optional: protect with a shared secret so only your main app can create sessions
  const secret = env("CHECKOUT_SESSION_SECRET")
  const got = req.headers["x-checkout-secret"]
  if (!got || got !== secret) return res.status(401).json({ ok: false, error: "unauthorized" })

  const { accessToken } = req.body || {}
  if (!accessToken || typeof accessToken !== "string") {
    return res.status(400).json({ ok: false, error: "missing_access_token" })
  }

  const sid = crypto.randomBytes(18).toString("base64url")
  const exp = Date.now() + 20 * 60 * 1000 // 20 min

  store.set(sid, { token: accessToken, exp })

  return res.status(200).json({ ok: true, sid, expiresInSec: 20 * 60 })
}
