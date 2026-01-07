// pages/_app.tsx

import { initI18n } from "components/data/i18n"
import { loadNewRelicAgent } from "components/data/NewRelic"
// pages/_app.tsx
import type { AppProps } from "next/app"
import { useEffect, useState } from "react"
import { BrowserRouter } from "react-router-dom"
import { pushDebug } from "utils/debugTrace"

import "../styles/theme.css"
import "../styles/globals.css"
import "../styles/check-icon.css"
import "../styles/expired-icon.css"
import "../styles/footer.css"
import "../styles/payment.css"
import "../styles/shipping.css"
import "../styles/place-order.css"
import "../styles/step-container.css"
import "../styles/address-input.css"
import "../styles/accordion.css"
export default function CheckoutApp({ Component, pageProps }: AppProps) {
  const [browser, setBrowser] = useState(false)

  useEffect(() => {
    initI18n() // ✅ runs ONLY in browser
    setBrowser(true)

    loadNewRelicAgent()

    try {
      pushDebug("APP_BOOT", {
        href: window.location.href,
        ua: navigator.userAgent,
        lang: navigator.language,
      })
    } catch {}
  }, [])

  if (!browser) return null

  return (
    <BrowserRouter basename={process.env.NEXT_PUBLIC_BASE_PATH || "/"}>
      <Component {...pageProps} />
    </BrowserRouter>
  )
}
