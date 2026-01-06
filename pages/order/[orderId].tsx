// pages/order/[orderId].tsx
import type { NextPage } from "next"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import Order from "../Order"

const OrderById: NextPage = () => {
  const router = useRouter()
  const { orderId } = router.query

  const [bootError, setBootError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Read accessToken ONLY from the URL query
  const accessToken = useMemo(() => {
    if (typeof window === "undefined") return null
    try {
      const url = new URL(window.location.href)
      const token = url.searchParams.get("accessToken")
      return token && token.trim() ? token.trim() : null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    if (!orderId) return

    if (!accessToken) {
      // No bootstrapping. Hosted flow requires token in URL.
      setBootError("missing_accessToken_in_url")
      return
    }

    setReady(true)
  }, [router.isReady, orderId, accessToken])

  if (bootError) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Checkout error</h1>
        <p>Could not initialize checkout.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {bootError}
          {"\n\n"}
          Expected URL format:
          {"\n"}
          /order/&lt;orderId&gt;?accessToken=&lt;sales_channel_token&gt;
        </pre>
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
