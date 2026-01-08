import type { Order } from "@commercelayer/sdk"
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

export const StepCustomer: React.FC<Props> = ({ className, step }) => {
  const appCtx = useContext(AppContext)
  const accordionCtx = useContext(AccordionContext)

  const [isLocalLoader, setIsLocalLoader] = useState(false)
  const lastRefreshedOrderIdRef = useRef<string | null>(null)

  /**
   * NEW meaning:
   * shipToDifferentAddress === billToDifferentAddress (show billing only when true)
   *
   * Compute initial value safely.
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

  // Keep in sync when order updates
  useEffect(() => {
    setShipToDifferentAddress(initialBillToDifferentAddress)
  }, [initialBillToDifferentAddress])

  /**
   * Old logic disabled/forced toggle based on billing country mismatch.
   * That no longer applies in your flow.
   */
  const [disabledShipToDifferentAddress, setDisabledShipToDifferentAddress] =
    useState(false)

  useEffect(() => {
    setDisabledShipToDifferentAddress(false)
  }, [appCtx?.shippingCountryCodeLock, appCtx?.billingAddress?.country_code])

  /**
   * Compatibility prop for some child components.
   * In the new flow this does nothing on purpose.
   */
  const openShippingAddress = (_props: ShippingToggleProps) => {
    // no-op
  }

  const handleSave = async (params: { success: boolean; order?: Order }) => {
    if (!appCtx) return
    if (!params?.success || !params?.order?.id) return

    setIsLocalLoader(true)

    // 1) Update app context with the saved order
    await appCtx.setAddresses(params.order)

    // 2) Trigger server refresh once per order id
    const isShipmentRequired = appCtx.isShipmentRequired === true

    // shipping address id can be present in different shapes
    const shippingAddressId =
      (params.order as any)?.shipping_address?.id ||
      (params.order as any)?.shipping_address_id ||
      (params.order as any)?.shipping_address?.data?.id

    const orderId = params.order.id

    if (
      isShipmentRequired &&
      shippingAddressId &&
      lastRefreshedOrderIdRef.current !== orderId
    ) {
      lastRefreshedOrderIdRef.current = orderId

      try {
        console.log("[StepCustomer] calling refresh", { orderId })

        const res = await fetch(`/api/orders/${orderId}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })

        const json = await res.json().catch(() => null)

        console.log("[StepCustomer] refresh response", {
          status: res.status,
          json,
        })

        if (!res.ok || !json?.ok) {
          console.warn("[StepCustomer] refresh failed", {
            status: res.status,
            json,
          })
        } else {
          // Force MFE to re-fetch order/shipments/stock transfers
          window.location.reload()
          return
        }
      } catch (e) {
        console.warn("[StepCustomer] refresh exception", e)
      }
    }

    // keep your scroll fix
    const tab = document.querySelector('div[tabindex="2"]')
    const top = tab?.scrollLeft as number
    const left = tab?.scrollTop as number
    window.scrollTo({ left, top, behavior: "smooth" })

    setIsLocalLoader(false)
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

interface EvaluateConditionsProps {
  countryCode?: string
  shippingCountryCodeLock: string | null | undefined
}

/**
 * Legacy helper kept for compatibility.
 * In your current flow we do NOT force/disable anything here.
 */
export function evaluateShippingToggle(
  _args: EvaluateConditionsProps,
): ShippingToggleProps {
  return { disableToggle: false }
}
