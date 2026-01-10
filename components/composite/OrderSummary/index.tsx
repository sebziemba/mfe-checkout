import LineItemsContainer from "@commercelayer/react-components/line_items/LineItemsContainer"
import LineItemsCount from "@commercelayer/react-components/line_items/LineItemsCount"
import AdjustmentAmount from "@commercelayer/react-components/orders/AdjustmentAmount"
import DiscountAmount from "@commercelayer/react-components/orders/DiscountAmount"
import GiftCardAmount from "@commercelayer/react-components/orders/GiftCardAmount"
import PaymentMethodAmount from "@commercelayer/react-components/orders/PaymentMethodAmount"
import ShippingAmount from "@commercelayer/react-components/orders/ShippingAmount"
import SubTotalAmount from "@commercelayer/react-components/orders/SubTotalAmount"
import TaxesAmount from "@commercelayer/react-components/orders/TaxesAmount"
import TotalAmount from "@commercelayer/react-components/orders/TotalAmount"
import type { AppProviderData } from "components/data/AppProvider"
import useDeviceDetect from "components/hooks/useDeviceDetect"
import { useSettingsOrInvalid } from "components/hooks/useSettingsOrInvalid"
import { LINE_ITEMS_SHOPPABLE } from "components/utils/constants"
import type React from "react"
import { useRef } from "react"
import { Trans, useTranslation } from "react-i18next"
import { CouponOrGiftCard } from "./CouponOrGiftCard"
import { ExpireTimer } from "./ExpireTimer"
import { LineItemTypes } from "./LineItemTypes"
import { ReturnToCart } from "./ReturnToCart"
import {
  AmountSpacer,
  AmountWrapper,
  RecapLine,
  RecapLineItem,
  RecapLineItemTotal,
  RecapLineTotal,
  SummaryHeader,
  SummarySubTitle,
  SummaryTitle,
  TotalWrapper,
  Wrapper,
} from "./styled"

interface Props {
  appCtx: AppProviderData
  hideItemCodes?: NullableType<boolean>
  readonly?: boolean
  isFinished?: () => void
  expiresAt?: NullableType<string>
  expirationInfo?: NullableType<ExpirationInfo>
}

const NL_VAT_RATE = 0.21

export const OrderSummary: React.FC<Props> = ({
  appCtx,
  readonly,
  hideItemCodes,
  isFinished,
  expiresAt,
  expirationInfo,
}) => {
  const { t, i18n } = useTranslation()
  const { isMobile } = useDeviceDetect()
  const { settings } = useSettingsOrInvalid()

  const hide_promo_code = settings?.config?.checkout?.hide_promo_code
  const isTaxCalculated = appCtx.isShipmentRequired
    ? appCtx.hasBillingAddress &&
      appCtx.hasShippingAddress &&
      appCtx.hasShippingMethod
    : appCtx.hasBillingAddress

  const taxesCentsRef = useRef(0)
  const shippingCentsRef = useRef(0)
  const netTotalCentsRef = useRef(0)

  const shouldShowEstimated = () =>
    !appCtx.taxIncluded && taxesCentsRef.current === 0

  const getEstimatedVatCents = () => {
    // Use the net total (after discounts) and exclude shipping from VAT base.
    const taxableBase = Math.max(
      netTotalCentsRef.current - shippingCentsRef.current,
      0,
    )
    return Math.round(taxableBase * NL_VAT_RATE)
  }

  // We'll capture subtotal cents during render via SubTotalAmount render-prop
  let subtotalCentsSnapshot = 0

  const formatMoneyFromCents = (cents: number) => {
    const currency =
      // try common places in appCtx; fallback to EUR
      (appCtx as any)?.order?.currency_code ??
      (appCtx as any)?.order?.currencyCode ??
      "EUR"

    const amount = cents / 100

    return new Intl.NumberFormat(i18n.language || "nl-NL", {
      style: "currency",
      currency,
    }).format(amount)
  }

  const lineItems = !readonly ? (
    <SummaryHeader>
      {expiresAt != null && !isMobile && (
        <ExpireTimer
          expiresAt={expiresAt}
          expirationInfo={expirationInfo}
          isFinished={isFinished}
        />
      )}
      <SummaryTitle data-testid="test-summary">
        {t("orderRecap.order_summary")}
      </SummaryTitle>
      <SummarySubTitle>
        <LineItemsCount
          data-testid="items-count"
          typeAccepted={LINE_ITEMS_SHOPPABLE}
        >
          {(props): JSX.Element => (
            <span data-testid="items-count">
              {t("orderRecap.cartContains", { count: props.quantity })}
            </span>
          )}
        </LineItemsCount>
      </SummarySubTitle>
    </SummaryHeader>
  ) : null

  return (
    <Wrapper data-testid="order-summary">
      <LineItemsContainer>
        <>
          {lineItems}
          <>
            {LINE_ITEMS_SHOPPABLE.map((type) => (
              <LineItemTypes
                type={type}
                key={type}
                hideItemCodes={hideItemCodes}
                taxIncluded={appCtx.taxIncluded ?? undefined}
              />
            ))}
          </>
        </>
      </LineItemsContainer>

      <TotalWrapper>
        <AmountSpacer />
        <AmountWrapper>
          {!hide_promo_code && (
            <CouponOrGiftCard
              readonly={readonly}
              setCouponOrGiftCard={appCtx.setCouponOrGiftCard}
            />
          )}

          <RecapLine>
            <RecapLineItem>{t("orderRecap.subtotal_amount")}</RecapLineItem>

            {/* Capture subtotal cents so we can estimate VAT even before Stripe tax exists */}
            <SubTotalAmount>
              {(props) => {
                if (typeof props.priceCents === "number") {
                  subtotalCentsSnapshot = props.priceCents
                }
                return <>{props.price}</>
              }}
            </SubTotalAmount>
          </RecapLine>

          <DiscountAmount>
            {(props) => {
              if (props.priceCents === 0) return <></>
              return (
                <RecapLine>
                  <RecapLineItem>
                    {t("orderRecap.discount_amount")}
                  </RecapLineItem>
                  <div data-testid="discount-amount">{props.price}</div>
                </RecapLine>
              )
            }}
          </DiscountAmount>

          <AdjustmentAmount>
            {(props) => {
              if (props.priceCents === 0) return <></>
              return (
                <RecapLine>
                  <RecapLineItem>
                    {t("orderRecap.adjustment_amount")}
                  </RecapLineItem>
                  <div data-testid="adjustment-amount">{props.price}</div>
                </RecapLine>
              )
            }}
          </AdjustmentAmount>

          <ShippingAmount>
            {(props) => {
              if (!appCtx.isShipmentRequired) return <></>

              shippingCentsRef.current =
                typeof props.priceCents === "number" ? props.priceCents : 0

              return (
                <RecapLine>
                  <RecapLineItem>
                    {t("orderRecap.shipping_amount")}
                  </RecapLineItem>
                  <div data-testid="shipping-amount">
                    {!appCtx.hasShippingMethod
                      ? t("orderRecap.notSet")
                      : props.priceCents === 0
                        ? t("general.free")
                        : props.price}
                  </div>
                </RecapLine>
              )
            }}
          </ShippingAmount>

          <PaymentMethodAmount>
            {(props) => {
              if (props.priceCents === 0) return <></>
              return (
                <RecapLine data-testid="payment-method-amount">
                  <RecapLineItem>
                    {t("orderRecap.payment_method_amount")}
                  </RecapLineItem>
                  {props.price}
                </RecapLine>
              )
            }}
          </PaymentMethodAmount>

          {/* VAT / Taxes row */}
          <RecapLine>
            <TaxesAmount>
              {(props) => {
                taxesCentsRef.current =
                  typeof props.priceCents === "number" ? props.priceCents : 0

                const showEstimated = shouldShowEstimated()
                const estimatedVatCents = getEstimatedVatCents()
                const estimatedVatFormatted =
                  formatMoneyFromCents(estimatedVatCents)

                return (
                  <>
                    <RecapLineItem>
                      <Trans
                        i18nKey={
                          appCtx.taxIncluded
                            ? "orderRecap.tax_included_amount"
                            : "orderRecap.tax_amount"
                        }
                        components={
                          appCtx.taxIncluded
                            ? {
                                style: (
                                  <span className="text-gray-500 font-normal" />
                                ),
                              }
                            : {}
                        }
                      />
                      {showEstimated && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600">
                          {t("general.estimated", "Estimated")} 21%
                        </span>
                      )}
                    </RecapLineItem>

                    <div data-testid="tax-amount">
                      {showEstimated ? estimatedVatFormatted : props.price}
                    </div>
                  </>
                )
              }}
            </TaxesAmount>
          </RecapLine>

          <GiftCardAmount>
            {(props) => {
              if (props.priceCents === 0) return <></>
              return (
                <RecapLine>
                  <RecapLineItem>
                    {t("orderRecap.giftcard_amount")}
                  </RecapLineItem>
                  <div data-testid="giftcard-amount">{props.price}</div>
                </RecapLine>
              )
            }}
          </GiftCardAmount>

          <RecapLineTotal>
            <RecapLineItemTotal>
              {t("orderRecap.total_amount")}
            </RecapLineItemTotal>

            <TotalAmount data-testid="total-amount">
              {(props) => {
                netTotalCentsRef.current =
                  typeof props.priceCents === "number" ? props.priceCents : 0

                const showEstimated = shouldShowEstimated()

                // If Stripe/CL already computed taxes, TotalAmount is already tax-inclusive — show it.
                if (!showEstimated || appCtx.taxIncluded) {
                  return (
                    <span className="text-xl font-medium">{props.price}</span>
                  )
                }

                // Otherwise, show estimated gross total:
                const estimatedVatCents = getEstimatedVatCents()
                const estimatedTotalCents =
                  netTotalCentsRef.current + estimatedVatCents
                const estimatedTotalFormatted =
                  formatMoneyFromCents(estimatedTotalCents)

                return (
                  <span className="text-xl font-medium">
                    {estimatedTotalFormatted}
                  </span>
                )
              }}
            </TotalAmount>
          </RecapLineTotal>

          {!appCtx.isComplete && <ReturnToCart cartUrl={appCtx.cartUrl} />}
        </AmountWrapper>
      </TotalWrapper>
    </Wrapper>
  )
}
