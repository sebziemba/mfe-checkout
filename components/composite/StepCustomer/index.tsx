// components/composite/StepCustomer/index.tsx

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

/**
 * Helper: get access token from ?accessToken=... in URL
 * (Sales Channel token passed from /checkout/start)
 */
function getAccessTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const url = new URL(window.location.href)
  return url.searchParams.get("accessToken")
}

/**
 * Helper: build a Commerce Layer client using Sales Channel token
 * This runs CLIENT-SIDE only.
 */
function getClientSideCL(accessToken: string) {
  const organization =
    process.env.NEXT_PUBLIC_CL_SLUG || process.env.NEXT_PUBLIC_CL_ORGANIZATION

  if (!organization) {
    throw new Error(
      "Missing NEXT_PUBLIC_CL_SLUG or NEXT_PUBLIC_CL_ORGANIZATION",
    )
  }

  const domain = process.env.NEXT_PUBLIC_CL_DOMAIN

  return CommerceLayer({
    organization,
    accessToken,
    ...(domain ? { domain } : {}),
  })
}

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

  /**
   * Trigger allocation by updating the order with autorefresh:true
   * using Sales Channel token (client-side), then re-fetch and log allocation state.
   */
  const triggerAutorefreshAndInspect = async (orderId: string) => {
    const accessToken = getAccessTokenFromUrl()
    if (!accessToken) {
      console.warn(
        "[StepCustomer] Missing accessToken in URL; cannot autorefresh",
      )
      return { ok: false as const, reason: "missing_access_token" as const }
    }

    const cl = getClientSideCL(accessToken)

    // 1) Trigger allocation
    console.log("[StepCustomer] triggering autorefresh update", { orderId })
    await cl.orders.update({
      type: "orders",
      id: orderId,
      autorefresh: true,
    } as any)

    // 2) Re-fetch the order and inspect shipments/transfers
    const fresh = await cl.orders.retrieve(orderId, {
      include: [
        "line_items",
        "shipments",
        "shipments.stock_transfers",
        "shipments.stock_location",
        "shipments.shipping_method",
        "shipments.available_shipping_methods",
      ],
    } as any)

    const shipments = (fresh as any)?.shipments ?? []

    const summary = shipments.map((s: any) => ({
      shipmentId: s?.id,
      status: s?.status,
      shippingMethodId: s?.shipping_method?.id ?? null,
      availableShippingMethodsCount: s?.available_shipping_methods?.length ?? 0,
      stockLocationId: s?.stock_location?.id ?? null,
      stockTransfersCount: s?.stock_transfers?.length ?? 0,
      stockTransferIds: (s?.stock_transfers ?? [])
        .map((t: any) => t?.id)
        .filter(Boolean),
    }))

    console.log("[StepCustomer] allocation check", {
      orderId,
      shipmentsCount: shipments.length,
      shipments: summary,
    })

    return { ok: true as const, fresh, summary }
  }

  const handleSave = async (params: { success: boolean; order?: Order }) => {
    if (!appCtx) return
    setIsLocalLoader(true)

    try {
      // 1) Update provider state first
      const orderToUse = params?.order ?? (await appCtx.getOrderFromRef())
      await appCtx.setAddresses(orderToUse)

      const orderId = orderToUse?.id || appCtx.orderId
      if (!orderId) {
        console.warn("[StepCustomer] missing orderId")
        return
      }

      // 2) Only do allocation trigger when shipment is required
      if (!appCtx.isShipmentRequired) {
        console.log(
          "[StepCustomer] shipment not required, skipping allocation trigger",
        )
        return
      }

      // Prevent double-triggering for same order
      if (lastRefreshOrderIdRef.current === orderId) {
        console.log(
          "[StepCustomer] autorefresh already triggered for this order",
          { orderId },
        )
        return
      }
      lastRefreshOrderIdRef.current = orderId

      // 3) Trigger allocation + inspect result
      const result = await triggerAutorefreshAndInspect(orderId)

      // 4) If CL created transfers, reload so UI proceeds
      if (result.ok) {
        const totalTransfers = (result.summary ?? []).reduce(
          (acc: number, s: any) => acc + (s.stockTransfersCount ?? 0),
          0,
        )

        if (totalTransfers > 0) {
          console.log("[StepCustomer] transfers exist, reloading")
          window.location.reload()
          return
        }

        // If still 0 transfers, this is a CL allocation failure.
        console.warn(
          "[StepCustomer] STILL 0 stock transfers after autorefresh — allocation failed in CL",
        )
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
