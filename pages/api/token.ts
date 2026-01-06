import type { NextApiRequest, NextApiResponse } from "next"
import { getSettings } from "utils/getSettings"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const orderId = String(req.query.orderId || "").trim()
    const accessToken = String(req.query.accessToken || "").trim()

    if (!orderId || !accessToken) {
      return res.status(400).json({
        validCheckout: false,
        retryOnError: false,
        error: "missing_orderId_or_accessToken",
      })
    }

    const settings = await getSettings({
      orderId,
      accessToken,
      subdomain: "", // unused on custom domain
      paymentReturn: req.query.paymentReturn === "true",
    })

    return res.status(200).json(settings)
  } catch (e: any) {
    return res.status(500).json({
      validCheckout: false,
      retryOnError: true,
      error: e?.message || "token_endpoint_error",
    })
  }
}
