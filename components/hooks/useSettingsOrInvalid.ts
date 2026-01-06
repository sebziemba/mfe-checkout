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

function pushDebug(entry: any) {
  try {
    const prev = JSON.parse(sessionStorage.getItem(DEBUG_KEY) || "[]")
    const next = [...prev, { at: new Date().toISOString(), ...entry }].slice(
      -200,
    )
    sessionStorage.setItem(DEBUG_KEY, JSON.stringify(next))
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

  // Log initial route context once
  useEffect(() => {
    pushDebug({
      step: "route_loaded",
      href: window.location.href,
      orderId: orderId ?? null,
      hasAccessToken: !!accessTokenFromUrl,
      tokenLen: accessTokenFromUrl?.length ?? 0,
      isPaymentReturn,
      hostname: window.location.hostname,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enforce official hosted format
  useEffect(() => {
    if (!orderId) return

    if (!accessTokenFromUrl) {
      pushDebug({ step: "missing_accessToken_in_url", orderId })
      console.error("[checkout] missing accessToken in URL", { orderId })
      navigate("/404")
      return
    }
  }, [orderId, accessTokenFromUrl, navigate])

  // Load settings
  useEffect(() => {
    const run = async () => {
      if (!orderId || !accessTokenFromUrl) return

      setIsFetching(true)
      pushDebug({ step: "getSettings_start", orderId })

      try {
        const fetchedSettings = await getSettings({
          accessToken: accessTokenFromUrl,
          orderId: orderId as string,
          paymentReturn: isPaymentReturn,
          subdomain: getSubdomain(window.location.hostname),
        })

        pushDebug({
          step: "getSettings_done",
          validCheckout: (fetchedSettings as any)?.validCheckout,
          retryOnError: (fetchedSettings as any)?.retryOnError,
          reason: (fetchedSettings as any)?.debugReason ?? null,
          orderId,
        })

        setSettings(fetchedSettings)
      } catch (e: any) {
        pushDebug({
          step: "getSettings_exception",
          orderId,
          message: e?.message ?? String(e),
        })
        console.error("[checkout] getSettings exception", e)
        navigate("/404")
      } finally {
        setIsFetching(false)
      }
    }

    run()
  }, [accessTokenFromUrl, orderId, isPaymentReturn, navigate])

  if (isFetching) return { isLoading: true, settings: undefined }

  if (settings && !settings.validCheckout) {
    pushDebug({
      step: "invalid_checkout_navigate_404",
      orderId,
      reason: (settings as any)?.debugReason ?? null,
      retryOnError: (settings as any)?.retryOnError ?? null,
    })

    if (!settings.retryOnError) navigate("/404")
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return { settings, isLoading: false }
}
