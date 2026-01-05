import type { NextApiRequest, NextApiResponse } from "next"

const mem = globalThis as any
mem.__checkoutSessions = mem.__checkoutSessions || new Map<string, { token: string; exp: number }>()
const store: Map<string, { token: string; exp: number }> = mem.__checkoutSessions

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const sid = String(req.query.sid || "")
  if (!sid) return res.status(400).json({ ok: false, error: "missing_sid" })

  const hit = store.get(sid)
  if (!hit) return res.status(404).json({ ok: false, error: "not_found" })

  if (Date.now() > hit.exp) {
    store.delete(sid)
    return res.status(410).json({ ok: false, error: "expired" })
  }

  return res.status(200).json({ ok: true, accessToken: hit.token })
}
