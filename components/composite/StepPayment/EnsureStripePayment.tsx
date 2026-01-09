import { AppContext } from "components/data/AppProvider"
import { type PropsWithChildren, useContext, useEffect, useState } from "react"
import { useParams } from "react-router-dom"

/**
 * Ensures the order has a Stripe payment source created with payment_method_types including iDEAL.
 * This is the ONLY moment where Stripe PaymentIntent configuration is decided.
 *
 * It runs only if the order currently has no payment_source (so we don't break already-created intents).
 */
export function EnsureStripePayment({ children }: PropsWithChildren) {
  const appCtx = useContext(AppContext)
  const { orderId } = useParams<{ orderId: string }>()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        if (!appCtx) return

        // These names might differ in your AppContext — see note below.
        const accessToken =
          // @ts-expect-error – depends on your AppContext shape
          appCtx.accessToken || appCtx.token || appCtx.salesChannelToken

        const endpoint =
          // @ts-expect-error – depends on your AppContext shape
          appCtx.endpoint || appCtx.apiEndpoint

        if (!accessToken || !endpoint || !orderId) {
          setReady(true)
          return
        }

        // 1) Fetch order to see if payment_source already exists
        const orderRes = await fetch(
          `${endpoint}/orders/${orderId}?include=payment_source`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.api+json",
            },
            cache: "no-store",
          },
        )

        const orderJson = await orderRes.json().catch(() => null)
        const hasPaymentSource = Boolean(
          orderJson?.data?.relationships?.payment_source?.data,
        )

        // If a payment source already exists, DON'T recreate it (would void/replace intent).
        if (hasPaymentSource) {
          if (!cancelled) setReady(true)
          return
        }

        // 2) Create stripe_payment with options including iDEAL
        // Commerce Layer: stripe_payments.create supports attributes.options :contentReference[oaicite:1]{index=1}
        const createRes = await fetch(`${endpoint}/stripe_payments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
          },
          body: JSON.stringify({
            data: {
              type: "stripe_payments",
              attributes: {
                // IMPORTANT: include a return_url (CL also recommends this when using auto_payments)
                // Keep it simple: back to the same page
                return_url: window.location.href,
                options: {
                  // ✅ This is what makes iDEAL appear
                  payment_method_types: [
                    "ideal",
                    "card",
                    "paypal",
                    "revolut_pay",
                  ],

                  // ✅ Avoid forcing save-for-future behavior.
                  // Don't set setup_future_usage at all (Stripe will omit the “future payments” message for many setups).
                  // If you must override, you can experiment with:
                  // payment_method_options: { card: { setup_future_usage: "none" } }
                },
              },
              relationships: {
                order: {
                  data: { type: "orders", id: orderId },
                },
              },
            },
          }),
          cache: "no-store",
        })

        if (!createRes.ok) {
          const t = await createRes.text().catch(() => "")
          console.warn(
            "[EnsureStripePayment] create stripe_payment failed",
            createRes.status,
            t.slice(0, 500),
          )
          if (!cancelled) setReady(true)
          return
        }

        if (!cancelled) setReady(true)
      } catch (e) {
        console.warn("[EnsureStripePayment] error", e)
        if (!cancelled) setReady(true)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [appCtx, orderId])

  if (!ready) return null
  return <>{children}</>
}
