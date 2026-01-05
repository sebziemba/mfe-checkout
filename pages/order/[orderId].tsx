// pages/order/[orderId].tsx
import type { NextPage } from "next"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import Order from "../Order"

const OrderById: NextPage = () => {
  const router = useRouter()
  const { orderId } = router.query

  const [bootError, setBootError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (!orderId) return

    const url = new URL(window.location.href)
    const accessToken = url.searchParams.get("accessToken")

    // If accessToken is already present, we’re ready
    if (accessToken && accessToken.trim()) {
      setReady(true)
      return
    }
    // Otherwise fetch guest token from our own API and add it to the URL
    ;(async () => {
      try {
        const r = await fetch("/api/guest-token", { cache: "no-store" })
        const json = await r.json().catch(() => null)

        if (!r.ok || !json?.ok || !json?.accessToken) {
          console.error("[order page] guest-token failed", {
            status: r.status,
            json,
          })
          setBootError(json?.error || "guest_token_failed")
          return
        }

        url.searchParams.set("accessToken", String(json.accessToken))
        // Use replace so the back button doesn't go to tokenless URL
        window.location.replace(url.toString())
      } catch (e: any) {
        console.error("[order page] guest-token exception", e)
        setBootError(e?.message || "guest_token_exception")
      }
    })()
  }, [router.isReady, orderId])

  if (bootError) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Checkout error</h1>
        <p>Could not initialize checkout.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{bootError}</pre>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ padding: 24 }}>
        <p>Loading checkout…</p>
      </div>
    )
  }

  return <Order />
}

export default OrderById
