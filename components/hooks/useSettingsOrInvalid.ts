import { useEffect, useRef, useState } from "react"
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
  const paymentIntentClientSecret = searchParams.get("payment_intent_client_secret")

  const isPaymentReturn =
    paymentReturn === "true" || !!redirectResult || !!paymentIntentClientSecret

  const [settings, setSettings] = useState<
    CheckoutSettings | InvalidCheckoutSettings | undefined
  >(undefined)

  const [isFetching, setIsFetching] = useState(true)

  const [savedAccessToken, setAccessToken] = useLocalStorageToken(
    "checkoutAccessToken",
    (accessTokenFromUrl || "") as string,
  )

  // Prevent double-calling /api/guest-token due to rerenders
  const guestFetchStartedRef = useRef(false)

  // 1) If token is in URL, persist it
  useEffect(() => {
    if (accessTokenFromUrl && accessTokenFromUrl !== savedAccessToken) {
      setAccessToken(accessTokenFromUrl)
    }
  }, [accessTokenFromUrl, savedAccessToken, setAccessToken])

  // 2) If no token anywhere, fetch guest token from server once
  useEffect(() => {
    const ensureToken = async () => {
      if (savedAccessToken) return
      if (guestFetchStartedRef.current) return
      guestFetchStartedRef.current = true

      try {
        const r = await fetch("/api/guest-token", { method: "POST" })
        const j = await r.json().catch(() => null)

        if (!j?.ok || !j?.accessToken) throw new Error("guest token failed")

        setAccessToken(j.accessToken)
      } catch {
        navigate("/404")
      }
    }

    ensureToken()
  }, [savedAccessToken, navigate, setAccessToken])

  // 3) Load settings once token + orderId exist
  useEffect(() => {
    const run = async () => {
      if (!savedAccessToken || !orderId) return

      setIsFetching(true)

      const fetchedSettings = await getSettings({
        accessToken: savedAccessToken,
        orderId: orderId as string,
        paymentReturn: isPaymentReturn,
        subdomain: getSubdomain(window.location.hostname),
      })

      setSettings(fetchedSettings)
      setIsFetching(false)

      // If invalid and not retryable, redirect here (avoid navigation during render)
      if (fetchedSettings && !fetchedSettings.validCheckout && !fetchedSettings.retryOnError) {
        navigate("/404")
      }
    }

    run()
  }, [savedAccessToken, orderId, isPaymentReturn, navigate])

  if (isFetching) return { isLoading: true, settings: undefined }

  if (settings && !settings.validCheckout) {
    // no navigate here; we already handled it in the effect
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return { settings: settings as CheckoutSettings | undefined, isLoading: false }
}
