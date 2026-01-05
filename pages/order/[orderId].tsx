import type { NextPage } from "next"
import { useEffect } from "react"
import Order from "../Order"

const OrderById: NextPage = () => {
  // This one often survives even when console.log is stripped:
  if (typeof window !== "undefined") {
    console.error("[order page] render", window.location.href)
  }

  useEffect(() => {
    console.error("[order page] useEffect", window.location.href)
  }, [])

  return <Order />
}

export default OrderById
