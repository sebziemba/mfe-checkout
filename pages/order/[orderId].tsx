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

    if (!accessToken || !accessToken.trim()) {
      setBootError("missing_accessToken_in_url")
      return
    }

    setReady(true)
  }, [router.isReady, orderId])

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
