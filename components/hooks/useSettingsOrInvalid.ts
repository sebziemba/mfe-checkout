import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { getSettings } from "utils/getSettings"
import { getSubdomain } from "utils/getSubdomain"

import { useLocalStorageToken } from "./useLocalStorageToken"

interface UseSettingsOrInvalid {
  settings?: CheckoutSettings
  retryOnError?: boolean
  isLoading: boolean
}

type SessionGetOk = { ok: true; accessToken: string }
type SessionGetErr = { ok: false; error?: string }
type SessionGetRes = SessionGetOk | SessionGetErr

async function fetchAccessTokenBySid(sid: string): Promise<string> {
  if (!sid) return ""
  try {
    const r = await fetch(
      `/api/checkout/session-get?sid=${encodeURIComponent(sid)}`,
      { cache: "no-store" },
    )
    const j = (await r.json().catch(() => null)) as SessionGetRes | null
    if (j && j.ok && typeof j.accessToken === "string" && j.accessToken) {
      return j.accessToken
    }
    return ""
  } catch {
    return ""
  }
}

export const useSettingsOrInvalid = (): UseSettingsOrInvalid => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()

  // ✅ Option A: sid in URL, token NOT in URL
  const sid = searchParams.get("sid")

  // Still support accessToken in URL (optional fallback for debugging)
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

  // ✅ Local storage token
  const [savedAccessToken, setAccessToken] = useLocalStorageToken(
    "checkoutAccessToken",
    (accessTokenFromUrl as string) || "",
  )

  const isPaymentReturn =
    paymentReturn === "true" || !!redirectResult || !!paymentIntentClientSecret

  // ✅ Decide which token we currently “want”:
  // - if URL provides accessToken, prefer it
  // - else use saved token (after we fetch it via sid)
  const effectiveAccessToken = useMemo(() => {
    return accessTokenFromUrl || savedAccessToken || ""
  }, [accessTokenFromUrl, savedAccessToken])

  // ✅ If accessToken is in URL and differs from saved, sync it
  useEffect(() => {
    if (accessTokenFromUrl && accessTokenFromUrl !== savedAccessToken) {
      setAccessToken(accessTokenFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessTokenFromUrl])

  // ✅ If there is NO token in URL, but we have sid, fetch token server-side
  useEffect(() => {
    let cancelled = false

    async function run() {
      // If we already have a token, no need to fetch
      if (accessTokenFromUrl || savedAccessToken) return

      // Need sid to fetch
      if (!sid) return

      const token = await fetchAccessTokenBySid(sid)
      if (!cancelled && token) {
        setAccessToken(token)
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid])

  // ✅ Fetch settings when we have a token + orderId
  useEffect(() => {
    let cancelled = false

    async function run() {
      const oid = (orderId as string) || ""
      if (!oid) return

      if (!effectiveAccessToken) return

      setIsFetching(true)

      const fetchedSettings = await getSettings({
        accessToken: effectiveAccessToken,
        orderId: oid,
        paymentReturn: isPaymentReturn,
        subdomain: getSubdomain(window.location.hostname),
      })

      if (!cancelled) {
        setSettings(fetchedSettings)
        setIsFetching(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [effectiveAccessToken, orderId, isPaymentReturn])

  /**
   * ✅ New validity rule:
   * - For normal checkout (not payment return), user must have EITHER:
   *   - sid in URL (preferred)
   *   - OR a saved token (in case they refreshed / came back)
   */
  if (!isPaymentReturn && !sid && !savedAccessToken && !accessTokenFromUrl) {
    navigate("/404")
    return { settings: undefined, isLoading: false }
  }

  if (isFetching) {
    return { isLoading: true, settings: undefined }
  }

  if (settings && !settings.validCheckout) {
    if (!settings.retryOnError) {
      navigate("/404")
    }
    return { settings: undefined, retryOnError: true, isLoading: false }
  }

  return {
    settings: settings as CheckoutSettings | undefined,
    isLoading: false,
  }
}
