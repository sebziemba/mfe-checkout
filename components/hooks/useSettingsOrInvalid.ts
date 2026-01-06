import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { getSettings } from "utils/getSettings"
import { getSubdomain } from "utils/getSubdomain"

interface UseSettingsOrInvalid {
  settings?: CheckoutSettings
  retryOnError?: boolean
  isLoading: boolean
}

const DEBUG_KEY = "cl_checkout_debug"

function pushDebug(step: string, data?: any) {
  try {
    const prev = sessionStorage.getItem(DEBUG_KEY)
    const arr = prev ? JSON.parse(prev) : []
    arr.push({
      ts: new Date().toISOString(),
      step,
      data,
    })
    sessionStorage.setItem(DEBUG_KEY, JSON.stringify(arr, null, 2))
  } catch {
    // ignore
  }
}

export const useSettingsOrInvalid = (): UseSettingsOrInvalid => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()

  const accessTokenFromUrl = useMemo(() => {
    const t = searchParams.get("accessToken")
    return t && t.trim() ? t.trim() : ""
  }, [searchParams])

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

  // RESET debug log on first load
  useEffect(() => {
    sessionStorage.removeItem(DEBUG_KEY)
    pushDebug("hook_init", {
      orderId,
      accessTokenPresent: !!accessTokenFromUrl,
      url: window.location.href,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enforce URL format
  useEffect(() => {
    if (!orderId) return

    if (!accessTokenFromUrl) {
      pushDebug("missing_accessToken_in_url")
      navigate("/404")
      return
    }
  }, [orderId, accessTokenFromUrl, navigate])

  // Load settings
  useEffect(() => {
    const run = async () => {
      if (!orderId || !accessTokenFromUrl) return

      setIsFetching(true)

      pushDebug("getSettings_start", {
        orderId,
        tokenPrefix: accessTokenFromUrl.slice(0, 16),
        tokenLength: accessTokenFromUrl.length,
        paymentReturn: isPaymentReturn,
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

    if (!settings.retryOnError) {
      navigate("/404")
    }

    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  pushDebug("checkout_valid")

  return { settings, isLoading: false }
}
