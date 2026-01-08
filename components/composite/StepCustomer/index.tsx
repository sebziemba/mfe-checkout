import type { Order } from "@commercelayer/sdk"
import { CommerceLayer } from "@commercelayer/sdk"
import classNames from "classnames"
import { AccordionContext } from "components/data/AccordionProvider"
import { AppContext } from "components/data/AppProvider"
import { StepContainer } from "components/ui/StepContainer"
import { StepContent } from "components/ui/StepContent"
import { StepHeader } from "components/ui/StepHeader"
import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { CheckoutAddresses } from "./CheckoutAddresses"
import { CheckoutCustomerAddresses } from "./CheckoutCustomerAddresses"

interface Props {
  className?: string
  step: number
}

/**
 * Legacy type name kept for compatibility with existing props.
 * In the new flow we don't use this to force/disable shipping.
 */
export interface ShippingToggleProps {
  forceShipping?: boolean
  disableToggle: boolean
}

/**
 * Legacy helper kept for compatibility.
 * In your current flow we do NOT force/disable anything here.
 */
interface EvaluateConditionsProps {
  countryCode?: string
  shippingCountryCodeLock: string | null | undefined
}

export function evaluateShippingToggle(
  _args: EvaluateConditionsProps,
): ShippingToggleProps {
  return { disableToggle: false }
}

/**
 * Helper: get access token from ?accessToken=... in URL
 * (MFE checkout uses this for the Sales Channel token)
 */
function getAccessTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const url = new URL(window.location.href)
  return url.searchParams.get("accessToken")
}

/**
 * Helper: build a CL client for client-side calls (Sales Channel token)
 * - organization: from NEXT_PUBLIC_CL_SLUG (or NEXT_PUBLIC_CL_ORGANIZATION)
 * - domain: optional (if you use custom domain), from NEXT_PUBLIC_CL_DOMAIN
 */
function getClientSideCL(accessToken: string) {
  const organization =
    process.env.NEXT_PUBLIC_CL_SLUG?.trim() ||
    process.env.NEXT_PUBLIC_CL_ORGANIZATION?.trim() ||
    ""

  if (!organization) {
    throw new Error(
      "Missing NEXT_PUBLIC_CL_SLUG (or NEXT_PUBLIC_CL_ORGANIZATION)",
    )
  }

  const domain = process.env.NEXT_PUBLIC_CL_DOMAIN?.trim() || undefined

  return CommerceLayer({
    organization,
    accessToken,
    ...(domain ? { domain } : {}),
  })
}

export const StepHeaderCustomer: React.FC<Props> = ({ step }) => {
  const appCtx = useContext(AppContext)
  const accordionCtx = useContext(AccordionContext)
  const { t } = useTranslation()

  if (!appCtx || !accordionCtx) return null

  const {
    hasShippingAddress,
    hasBillingAddress,
    emailAddress,
    isShipmentRequired,
  } = appCtx

  const recapText = () => {
    const isCustomerAddressSet = isShipmentRequired
      ? hasShippingAddress
      : hasBillingAddress

    if (!isCustomerAddressSet || accordionCtx.status === "edit") {
      return (
        <p data-testid="customer-addresses-title">
          {isShipmentRequired
            ? t("stepCustomer.notSet")
            : t("stepCustomer.notSetNoDelivery")}
        </p>
      )
    }

    return <p data-testid="customer-email-step-header">{emailAddress}</p>
  }

  return (
    <StepHeader
      stepNumber={step}
      status={accordionCtx.status}
      label={t("stepCustomer.title")}
      info={recapText()}
      onEditRequest={accordionCtx.setStep}
    />
  )
}

export const StepCustomer: React.FC<Props> = ({ className }) => {
  const appCtx = useContext(AppContext)
  const accordionCtx = useContext(AccordionContext)

  const [isLocalLoader, setIsLocalLoader] = useState(false)

  // Prevent double-triggering allocation for the same order id
  const lastAutorefreshOrderIdRef = useRef<string | null>(null)

  /**
   * NEW meaning:
   * shipToDifferentAddress === billToDifferentAddress (show billing only when true)
   */
  const initialBillToDifferentAddress = useMemo(() => {
    const shipId = appCtx?.shippingAddress?.id
    const billId = appCtx?.billingAddress?.id
    if (!shipId || !billId) return false
    return shipId !== billId
  }, [appCtx?.shippingAddress?.id, appCtx?.billingAddress?.id])

  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(
    initialBillToDifferentAddress,
  )

  useEffect(() => {
    setShipToDifferentAddress(initialBillToDifferentAddress)
  }, [initialBillToDifferentAddress])

  const [disabledShipToDifferentAddress, setDisabledShipToDifferentAddress] =
    useState(false)

  useEffect(() => {
    setDisabledShipToDifferentAddress(false)
  }, [appCtx?.shippingCountryCodeLock, appCtx?.billingAddress?.country_code])

  const openShippingAddress = (_props: ShippingToggleProps) => {
    // no-op
  }

  /**
   * ✅ THE FIX:
   * After saving addresses, force an ORDER UPDATE with autorefresh:true
   * using the Sales Channel token (client-side).
   *
   * This is the only reliable way to trigger shipments/stock transfers allocation
   * in your setup (since POST /_refresh returns 404).
   */
  const triggerAutorefreshUpdate = async (orderId: string) => {
    const accessToken = getAccessTokenFromUrl()
    if (!accessToken) {
      console.warn(
        "[StepCustomer] Missing accessToken in URL; cannot autorefresh",
      )
      return
    }

    const cl = getClientSideCL(accessToken)

    console.log("[StepCustomer] triggering autorefresh update", { orderId })

    // Minimal update that triggers allocation
    await cl.orders.update({
      type: "orders",
      id: orderId,
      autorefresh: true,
    } as any)
  }

  const handleSave = async (params: { success: boolean; order?: Order }) => {
    if (!appCtx) return

    setIsLocalLoader(true)

    try {
      // 1) Update the AppProvider state first
      const orderToUse = params?.order ?? (await appCtx.getOrderFromRef())

      await appCtx.setAddresses(orderToUse)

      // 2) If shipment required, trigger allocation
      // We must use a REAL order update (autorefresh:true)
      const orderId = orderToUse?.id || appCtx.orderId

      if (
        appCtx.isShipmentRequired &&
        orderId &&
        lastAutorefreshOrderIdRef.current !== orderId
      ) {
        lastAutorefreshOrderIdRef.current = orderId

        try {
          await triggerAutorefreshUpdate(orderId)
          console.log("[StepCustomer] autorefresh update done; reloading")
          window.location.reload()
          return
        } catch (e) {
          console.warn("[StepCustomer] autorefresh update failed", e)
          // If this fails, we still continue (UI will show errors)
        }
      }
    } catch (e) {
      console.warn("[StepCustomer] handleSave exception", e)
    } finally {
      // keep your scroll fix
      const tab = document.querySelector('div[tabindex="2"]')
      const top = tab?.scrollLeft as number
      const left = tab?.scrollTop as number
      window.scrollTo({ left, top, behavior: "smooth" })

      setIsLocalLoader(false)
    }
  }

  if (!appCtx || !accordionCtx) return null

  const {
    isGuest,
    isShipmentRequired,
    billingAddress,
    shippingAddress,
    emailAddress,
    hasSameAddresses,
    isUsingNewBillingAddress,
    isUsingNewShippingAddress,
    hasCustomerAddresses,
    shippingCountryCodeLock,
    setCustomerEmail,
  } = appCtx

  return (
    <StepContainer
      className={classNames(className, {
        current: accordionCtx.isActive,
        done: !accordionCtx.isActive,
        submitting: isLocalLoader,
      })}
    >
      <StepContent>
        {accordionCtx.isActive ? (
          isGuest ? (
            <CheckoutAddresses
              shippingAddress={shippingAddress}
              billingAddress={billingAddress}
              emailAddress={emailAddress}
              hasSameAddresses={hasSameAddresses}
              setCustomerEmail={setCustomerEmail}
              isShipmentRequired={isShipmentRequired}
              isLocalLoader={isLocalLoader}
              openShippingAddress={openShippingAddress}
              shipToDifferentAddress={shipToDifferentAddress}
              setShipToDifferentAddress={setShipToDifferentAddress}
              disabledShipToDifferentAddress={disabledShipToDifferentAddress}
              handleSave={handleSave}
            />
          ) : (
            <CheckoutCustomerAddresses
              shippingAddress={shippingAddress}
              billingAddress={billingAddress}
              emailAddress={emailAddress}
              hasCustomerAddresses={hasCustomerAddresses}
              isShipmentRequired={isShipmentRequired}
              isUsingNewShippingAddress={isUsingNewShippingAddress}
              isUsingNewBillingAddress={isUsingNewBillingAddress}
              hasSameAddresses={hasSameAddresses}
              isLocalLoader={isLocalLoader}
              shippingCountryCodeLock={shippingCountryCodeLock}
              openShippingAddress={openShippingAddress}
              shipToDifferentAddress={shipToDifferentAddress}
              setShipToDifferentAddress={setShipToDifferentAddress}
              disabledShipToDifferentAddress={disabledShipToDifferentAddress}
              handleSave={handleSave}
            />
          )
        ) : null}
      </StepContent>
    </StepContainer>
  )
}
