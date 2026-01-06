import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { getSettings } from "utils/getSettings"
import { getSubdomain } from "utils/getSubdomain"

interface UseSettingsOrInvalid {
  settings?: CheckoutSettings
  retryOnError?: boolean
  isLoading: boolean
}

function dbg(enabled: boolean, ...args: any[]) {
  if (!enabled) return
  console.error(...args)
}

export const useSettingsOrInvalid = (): UseSettingsOrInvalid => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()

  const debug = searchParams.get("debug") === "1"

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

  useEffect(() => {
    dbg(debug, "[checkout][debug] useSettingsOrInvalid mount/update", {
      orderId,
      hasAccessTokenInUrl: !!accessTokenFromUrl,
      accessTokenPrefix: accessTokenFromUrl
        ? accessTokenFromUrl.slice(0, 16)
        : null,
      accessTokenLen: accessTokenFromUrl ? accessTokenFromUrl.length : 0,
      isPaymentReturn,
      href: typeof window !== "undefined" ? window.location.href : null,
    })
  }, [debug, orderId, accessTokenFromUrl, isPaymentReturn])

  // ✅ Enforce official hosted format:
  // /order/:orderId?accessToken=<sales_channel_token>
  useEffect(() => {
    if (!orderId) return

    if (!accessTokenFromUrl) {
      dbg(
        debug,
        "[checkout][debug] missing accessToken in URL → navigate(/404)",
        {
          orderId,
          href: typeof window !== "undefined" ? window.location.href : null,
        },
      )
      navigate("/404")
      return
    }
  }, [orderId, accessTokenFromUrl, navigate, debug])

  // ✅ Load settings (only when token exists in URL)
  useEffect(() => {
    const run = async () => {
      if (!orderId || !accessTokenFromUrl) return

      setIsFetching(true)
      dbg(debug, "[checkout][debug] calling getSettings()", {
        orderId,
        accessTokenPrefix: accessTokenFromUrl.slice(0, 16),
        accessTokenLen: accessTokenFromUrl.length,
      })

      try {
        const fetchedSettings = await getSettings({
          accessToken: accessTokenFromUrl,
          orderId: orderId as string,
          paymentReturn: isPaymentReturn,
          // kept for signature compatibility
          subdomain: getSubdomain(window.location.hostname),
          debug,
        } as any)

        dbg(debug, "[checkout][debug] getSettings() returned", fetchedSettings)

        setSettings(fetchedSettings)
      } catch (e: any) {
        dbg(debug, "[checkout][debug] getSettings() threw", {
          name: e?.name,
          message: e?.message,
          status: e?.status || e?.response?.status,
          errors: e?.errors || e?.response?.errors,
          data: e?.response?.data,
        })
        // keep consistent with invalid checkout behavior:
        navigate("/404")
      } finally {
        setIsFetching(false)
      }
    }

    run()
  }, [accessTokenFromUrl, orderId, isPaymentReturn, debug, navigate])

  if (isFetching) return { isLoading: true, settings: undefined }

  if (settings && !settings.validCheckout) {
    dbg(debug, "[checkout][debug] invalid checkout settings", settings)
    if (!settings.retryOnError) navigate("/404")
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return { settings, isLoading: false }
}
