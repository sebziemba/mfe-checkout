// components/composite/StepCustomer/index.tsx

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

  // prevent double refresh calls for the same order within one save cycle
  const lastRefreshOrderIdRef = useRef<string | null>(null)

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

  /**
   * Compatibility prop for children.
   * In your flow this is intentionally a no-op.
   */
  const openShippingAddress = (_props: ShippingToggleProps) => {
    // no-op
  }

  /**
   * Calls your Next.js API route:
   * POST /api/orders/:orderId/refresh
   */
  const callOrderRefreshEndpoint = async (orderId: string) => {
    const refreshUrl = new URL(
      `/api/orders/${orderId}/refresh`,
      window.location.origin,
    ).toString()

    const res = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    })

    const json = await res.json().catch(() => null)

    console.log("[StepCustomer] refresh response", {
      status: res.status,
      ok: res.ok,
      json,
    })

    return { res, json }
  }

  const handleSave = async (params: { success: boolean; order?: Order }) => {
    if (!appCtx) return

    setIsLocalLoader(true)

    try {
      // 1) Always push address changes into context first
      const orderToUse = params?.order ?? (await appCtx.getOrderFromRef())
      await appCtx.setAddresses(orderToUse)

      // 2) If shipping is required, force refresh allocation server-side
      if (!appCtx.isShipmentRequired) return

      const orderId = orderToUse?.id || appCtx.orderId
      if (!orderId) return

      // avoid double POSTs for same order during rapid renders
      if (lastRefreshOrderIdRef.current === orderId) return
      lastRefreshOrderIdRef.current = orderId

      const { res, json } = await callOrderRefreshEndpoint(orderId)

      // 3) If refresh OK, re-fetch order into context (no hard reload)
      if (res.ok && json?.ok) {
        const refreshed = await appCtx.getOrderFromRef()
        await appCtx.setAddresses(refreshed)

        // Optional: close the accordion step if your provider supports it.
        // If this causes TS issues in your project, delete these 2 lines.
        try {
          // @ts-expect-error - depends on your AccordionProvider typings
          accordionCtx.setStep?.()
        } catch {
          // ignore
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
