import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
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

  // ✅ ONLY from URL query
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

  // ✅ Enforce official hosted format:
  // /order/:orderId?accessToken=<sales_channel_token>
  useEffect(() => {
    if (!orderId) return

    if (!accessTokenFromUrl) {
      navigate("/404")
      return
    }
  }, [orderId, accessTokenFromUrl, navigate])

  // ✅ Load settings (only when token exists in URL)
  useEffect(() => {
    const run = async () => {
      if (!orderId || !accessTokenFromUrl) return

      setIsFetching(true)

      const fetchedSettings = await getSettings({
        accessToken: accessTokenFromUrl,
        orderId: orderId as string,
        paymentReturn: isPaymentReturn,
        // keep for signature compatibility (custom domain means it's not reliable)
        subdomain: getSubdomain(window.location.hostname),
      })

      setSettings(fetchedSettings)
      setIsFetching(false)
    }

    run()
  }, [accessTokenFromUrl, orderId, isPaymentReturn])

  if (isFetching) return { isLoading: true, settings: undefined }

  if (settings && !settings.validCheckout) {
    if (!settings.retryOnError) navigate("/404")
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return { settings, isLoading: false }
}
