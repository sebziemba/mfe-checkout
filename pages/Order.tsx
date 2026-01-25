import CheckoutSkeleton from "components/composite/CheckoutSkeleton"
import { RetryError } from "components/composite/RetryError"
import { useSettingsOrInvalid } from "components/hooks/useSettingsOrInvalid"
import type { NextPage } from "next"
import dynamic from "next/dynamic"

const DynamicCheckoutContainer = dynamic(
  () => import("components/composite/CheckoutContainer"),
  {
    loading: function LoadingSkeleton() {
      return <CheckoutSkeleton />
    },
  },
)
const DynamicCheckout = dynamic(() => import("components/composite/Checkout"), {
  loading: function LoadingSkeleton() {
    return <CheckoutSkeleton />
  },
})

CheckoutSkeleton.displayName = "Skeleton Loader"

const Order: NextPage = () => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    console.log("[checkout] url", {
      pathname: window.location.pathname,
      orderIdFromPath: window.location.pathname
        .split("/")
        .filter(Boolean)
        .pop(),
      accessTokenPresent: params.has("accessToken"),
      accessTokenLength: params.get("accessToken")?.length,
    })
  }

  const { settings, retryOnError, isLoading } = useSettingsOrInvalid()

  console.log("[checkout] settings_state", {
    isLoading,
    hasSettings: Boolean(settings),
    retryOnError,
  })

  if (isLoading || (!settings && !retryOnError)) return <CheckoutSkeleton />

  if (!settings) {
    if (retryOnError) {
      return <RetryError />
    }
    return <RetryError />
  }

  return (
    <DynamicCheckoutContainer settings={settings}>
      <DynamicCheckout
        logoUrl={settings.logoUrl}
        primaryColor={settings.primaryColor}
        orderNumber={settings.orderNumber}
        companyName={settings.companyName}
        supportEmail={settings.supportEmail}
        supportPhone={settings.supportPhone}
        thankyouPageUrl={settings.config?.checkout?.thankyou_page}
        hideItemCodes={settings.config?.checkout?.hide_item_codes}
        termsUrl={settings.termsUrl}
        privacyUrl={settings.privacyUrl}
        gtmId={settings.gtmId}
        expiresAt={settings.expiresAt}
        expirationInfo={settings.expirationInfo}
      />
    </DynamicCheckoutContainer>
  )
}

export default Order
