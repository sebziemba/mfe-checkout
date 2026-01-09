import { AppContext } from "components/data/AppProvider"
import { createStripePaymentForOrder } from "components/data/stripe/createStripePayment"
import { type PropsWithChildren, useContext, useEffect, useState } from "react"

export function EnsureStripePayment({ children }: PropsWithChildren) {
  const appCtx = useContext(AppContext)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        if (!appCtx) return
        const { slug, domain, accessToken, orderId } = appCtx

        // We need the latest order from CL to check if payment_source exists
        const o = await appCtx.getOrderFromRef()

        const hasPaymentSource = Boolean((o as any)?.payment_source?.id)
        if (!hasPaymentSource) {
          await createStripePaymentForOrder({
            organization: slug,
            domain,
            accessToken,
            orderId,
          })

          // refresh local order state so components see payment_source
          const updated = await appCtx.getOrderFromRef()
          appCtx.getOrder(updated)
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
  }, [appCtx])

  if (!ready) return null
  return <>{children}</>
}
