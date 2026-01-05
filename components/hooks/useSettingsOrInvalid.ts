import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { getSettings } from "utils/getSettings"
import { getSubdomain } from "utils/getSubdomain"
import { useLocalStorageToken } from "./useLocalStorageToken"

interface UseSettingsOrInvalid {
  settings?: CheckoutSettings
  retryOnError?: boolean
  isLoading: boolean
}

export const useSettingsOrInvalid = (): UseSettingsOrInvalid => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()

  const accessTokenFromUrl = searchParams.get("accessToken")
  const paymentReturn = searchParams.get("paymentReturn")
  const redirectResult = searchParams.get("redirectResult")
  const paymentIntentClientSecret = searchParams.get(
    "payment_intent_client_secret",
  )

  const [settings, setSettings] = useState<
    CheckoutSettings | InvalidCheckoutSettings | undefined
  >(undefined)
  const [isFetching, setIsFetching] = useState(true)

  const [savedAccessToken, setAccessToken] = useLocalStorageToken(
    "checkoutAccessToken",
    (accessTokenFromUrl as string) || "",
  )

  const isPaymentReturn =
    paymentReturn === "true" || !!redirectResult || !!paymentIntentClientSecret

  // 1) If token exists in URL, store it
  useEffect(() => {
    if (accessTokenFromUrl && accessTokenFromUrl !== savedAccessToken) {
      setAccessToken(accessTokenFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessTokenFromUrl])

  // 2) If no token anywhere, fetch Sales Channel token from checkout server
  useEffect(() => {
    const ensureToken = async () => {
      if (savedAccessToken) return

      try {
        const r = await fetch("/api/guest-token", { method: "POST" })
        const j = await r.json()
        if (!j?.ok || !j?.accessToken) throw new Error("guest token failed")
        setAccessToken(j.accessToken)
      } catch {
        navigate("/404")
      }
    }

    ensureToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAccessToken])

  // 3) Load settings once token exists
  useEffect(() => {
    const run = async () => {
      if (!savedAccessToken || !orderId) return

      setIsFetching(true)
      const fetchedSettings = await getSettings({
        accessToken: savedAccessToken,
        orderId: orderId as string,
        paymentReturn: isPaymentReturn,
        // subdomain is now NOT used for validation after step #2 change,
        // but keep it to avoid touching more code.
        subdomain: getSubdomain(window.location.hostname),
      })

      setSettings(fetchedSettings)
      setIsFetching(false)
    }

    run()
  }, [savedAccessToken, orderId, isPaymentReturn])

  if (isFetching) return { isLoading: true, settings: undefined }

  if (settings && !settings.validCheckout) {
    if (!settings.retryOnError) navigate("/404")
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return { settings, isLoading: false }
}
