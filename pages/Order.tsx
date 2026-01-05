import CheckoutSkeleton from "components/composite/CheckoutSkeleton"
import { RetryError } from "components/composite/RetryError"
import { useSettingsOrInvalid } from "components/hooks/useSettingsOrInvalid"
import type { NextPage } from "next"
import dynamic from "next/dynamic"
import { useRouter } from "next/router"

const DynamicCheckoutContainer = dynamic(
  () => import("components/composite/CheckoutContainer"),
  {
    loading: function LoadingSkeleton() {
      return <CheckoutSkeleton />
    },
  }
)

const DynamicCheckout = dynamic(() => import("components/composite/Checkout"), {
  loading: function LoadingSkeleton() {
    return <CheckoutSkeleton />
  },
})

CheckoutSkeleton.displayName = "Skeleton Loader"

const Order: NextPage = () => {
  const router = useRouter()

  // ✅ ONLY check for sid now
  const sid = typeof router.query.sid === "string" ? router.query.sid : ""

  const { settings, retryOnError, isLoading } = useSettingsOrInvalid()

  if (isLoading || (!settings && !retryOnError)) {
    return <CheckoutSkeleton />
  }

  // ❌ No sid = invalid entry point
  if (!sid) {
    return <RetryError />
  }

  if (!settings) {
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
