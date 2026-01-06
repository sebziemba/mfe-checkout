import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { clearDebug, pushDebug } from "utils/debugTrace"
import { getSettings } from "utils/getSettings"
import { getSubdomain } from "utils/getSubdomain"

interface UseSettingsOrInvalid {
  settings?: CheckoutSettings
  retryOnError?: boolean
  isLoading: boolean
}

export const useSettingsOrInvalid = (): UseSettingsOrInvalid => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()

  const accessTokenFromUrl = (searchParams.get("accessToken") || "").trim()

  const paymentReturn = searchParams.get("paymentReturn")
  const redirectResult = searchParams.get("redirectResult")
  const paymentIntentClientSecret = searchParams.get(
    "payment_intent_client_secret",
  )

  const isPaymentReturn =
    paymentReturn === "true" || !!redirectResult || !!paymentIntentClientSecret

  const [settings, setSettings] = useState<
    CheckoutSettings | InvalidCheckoutSettings | undefined
  >(undefined)
  const [isFetching, setIsFetching] = useState(true)

  const didInit = useRef(false)

  // ✅ Synchronous init (not useEffect) so it happens even if we redirect fast
  if (!didInit.current && typeof window !== "undefined") {
    didInit.current = true
    clearDebug()
    pushDebug("hook_init", {
      href: window.location.href,
      orderId,
      hasAccessToken: !!accessTokenFromUrl,
      accessTokenPrefix: accessTokenFromUrl
        ? accessTokenFromUrl.slice(0, 16)
        : null,
      accessTokenLen: accessTokenFromUrl ? accessTokenFromUrl.length : 0,
    })
  }

  // ✅ Enforce token in URL
  useEffect(() => {
    if (!orderId) return

    if (!accessTokenFromUrl) {
      pushDebug("missing_accessToken_in_url", { orderId })
      navigate("/404")
      return
    }
  }, [orderId, accessTokenFromUrl, navigate])

  // ✅ Load settings
  useEffect(() => {
    const run = async () => {
      if (!orderId || !accessTokenFromUrl) return

      setIsFetching(true)

      pushDebug("getSettings_start", {
        orderId,
        paymentReturn: isPaymentReturn,
        subdomain: getSubdomain(window.location.hostname),
      })

      const fetchedSettings = await getSettings({
        accessToken: accessTokenFromUrl,
        orderId: orderId as string,
        paymentReturn: isPaymentReturn,
        subdomain: getSubdomain(window.location.hostname),
        debug: true,
      })

      pushDebug("getSettings_result", fetchedSettings)

      setSettings(fetchedSettings)
      setIsFetching(false)
    }

    run()
  }, [accessTokenFromUrl, orderId, isPaymentReturn])

  if (isFetching) {
    pushDebug("loading_state")
    return { isLoading: true, settings: undefined }
  }

  if (settings && !settings.validCheckout) {
    pushDebug("invalid_checkout", settings)

    if (!settings.retryOnError) navigate("/404")
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  pushDebug("checkout_valid")
  return { settings, isLoading: false }
}
