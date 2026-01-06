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
  const didLogLoading = useRef(false)
  const didLogValid = useRef(false)
  const didNavigate404 = useRef(false)

  // ✅ init trace once
  useEffect(() => {
    if (didInit.current) return
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ enforce token in URL
  useEffect(() => {
    if (!orderId) return

    if (!accessTokenFromUrl) {
      pushDebug("missing_accessToken_in_url", { orderId })

      // prevent multiple navigations / double logs
      if (!didNavigate404.current) {
        didNavigate404.current = true
        navigate("/404")
      }
    }
  }, [orderId, accessTokenFromUrl, navigate])

  // ✅ load settings
  useEffect(() => {
    const run = async () => {
      if (!orderId || !accessTokenFromUrl) return

      setIsFetching(true)
      didLogLoading.current = false
      didLogValid.current = false

      const subdomain = getSubdomain(window.location.hostname)

      pushDebug("getSettings_start", {
        orderId,
        paymentReturn: isPaymentReturn,
        subdomain,
      })

      try {
        const fetchedSettings = await getSettings({
          accessToken: accessTokenFromUrl,
          orderId: orderId as string,
          paymentReturn: isPaymentReturn,
          subdomain,
          debug: true,
        })

        pushDebug("getSettings_result", fetchedSettings)
        setSettings(fetchedSettings)
      } catch (e: any) {
        pushDebug("getSettings_throw", {
          message: e?.message,
          name: e?.name,
        })
        setSettings({ validCheckout: false, retryOnError: true } as any)
      } finally {
        setIsFetching(false)
      }
    }

    run()
  }, [accessTokenFromUrl, orderId, isPaymentReturn])

  // ✅ log loading state ONCE per load
  useEffect(() => {
    if (!isFetching) return
    if (didLogLoading.current) return
    didLogLoading.current = true
    pushDebug("loading_state")
  }, [isFetching])

  // ✅ invalid checkout -> log + redirect
  useEffect(() => {
    if (!settings) return
    if (isFetching) return

    if (!settings.validCheckout) {
      pushDebug("invalid_checkout", settings)

      if (!settings.retryOnError && !didNavigate404.current) {
        didNavigate404.current = true
        navigate("/404")
      }
    }
  }, [settings, isFetching, navigate])

  // ✅ valid checkout -> log once
  useEffect(() => {
    if (!settings) return
    if (isFetching) return
    if (!settings.validCheckout) return
    if (didLogValid.current) return

    didLogValid.current = true
    pushDebug("checkout_valid", {
      orderId: (settings as any)?.orderId,
      endpoint: (settings as any)?.endpoint,
      slug: (settings as any)?.slug,
    })
  }, [settings, isFetching])

  // render output (NO logging here)
  if (isFetching) return { isLoading: true, settings: undefined }

  if (settings && !settings.validCheckout) {
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return { settings, isLoading: false }
}
