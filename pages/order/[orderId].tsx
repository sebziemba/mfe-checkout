import type { NextPage } from "next"
import { useEffect } from "react"
import Order from "../Order"

const OrderById: NextPage = () => {
  useEffect(() => {
    console.log("[order page] loaded", window.location.href)
  }, [])
  return <Order />
}

export default OrderById
