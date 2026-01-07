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
import { useMemo } from "react"
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

const VAT_RATE = 0.21

export const OrderSummary: React.FC<Props> = ({
  appCtx,
  readonly,
  hideItemCodes,
  isFinished,
  expiresAt,
  expirationInfo,
}) => {
  const { t } = useTranslation()
  const { isMobile } = useDeviceDetect()
  const { settings } = useSettingsOrInvalid()

  const hide_promo_code = settings?.config?.checkout?.hide_promo_code

  // CL "calculated" gate (their logic)
  const isTaxCalculated = appCtx.isShipmentRequired
    ? appCtx.hasBillingAddress &&
      appCtx.hasShippingAddress &&
      appCtx.hasShippingMethod
    : appCtx.hasBillingAddress

  // formatting helpers
  const locale = useMemo(() => {
    return (appCtx as any)?.language || (appCtx as any)?.locale || "nl-NL"
  }, [appCtx])

  const currency = useMemo(() => {
    return (
      (appCtx as any)?.currencyCode || (appCtx as any)?.currency_code || "EUR"
    )
  }, [appCtx])

  const fmt = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    })
  }, [locale, currency])

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
          {LINE_ITEMS_SHOPPABLE.map((type) => (
            <LineItemTypes
              type={type}
              key={type}
              hideItemCodes={hideItemCodes}
            />
          ))}
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

          {/* ✅ Subtotal EXCL VAT (derived if market is taxIncluded) */}
          <SubTotalAmount>
            {(sub: any) => {
              const grossCents = Number(sub?.priceCents || 0)

              const netCents = appCtx.taxIncluded
                ? Math.round(grossCents / (1 + VAT_RATE))
                : grossCents

              return (
                <RecapLine>
                  <RecapLineItem>
                    {t("orderRecap.subtotal_amount")}{" "}
                    {appCtx.taxIncluded ? "(excl. BTW)" : ""}
                  </RecapLineItem>
                  <div data-testid="subtotal-amount">
                    {fmt.format(netCents / 100)}
                  </div>
                </RecapLine>
              )
            }}
          </SubTotalAmount>

          <DiscountAmount>
            {(props: any) => {
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
            {(props: any) => {
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
            {(props: any) => {
              if (!appCtx.isShipmentRequired) return <></>
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
            {(props: any) => {
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

          {/* ✅ VAT line: show immediately (derived 21%) until CL calculates */}
          <TaxesAmount>
            {(tax: any) => {
              return (
                <SubTotalAmount>
                  {(sub: any) => {
                    const grossCents = Number(sub?.priceCents || 0)

                    // If CL calculated taxes, use CL's number.
                    // If not calculated yet, derive 21% VAT from subtotal.
                    const taxCents = isTaxCalculated
                      ? Number(tax?.priceCents || 0)
                      : appCtx.taxIncluded
                        ? Math.max(
                            0,
                            grossCents -
                              Math.round(grossCents / (1 + VAT_RATE)),
                          )
                        : Math.round(grossCents * VAT_RATE)

                    return (
                      <RecapLine>
                        <RecapLineItem>
                          <Trans
                            i18nKey={
                              appCtx.taxIncluded
                                ? "orderRecap.tax_included_amount"
                                : "orderRecap.tax_amount"
                            }
                            components={
                              isTaxCalculated
                                ? {
                                    style: (
                                      <span
                                        className={
                                          appCtx.taxIncluded
                                            ? "text-gray-500 font-normal"
                                            : ""
                                        }
                                      />
                                    ),
                                  }
                                : {}
                            }
                          />
                        </RecapLineItem>

                        <div data-testid="tax-amount">
                          {fmt.format(taxCents / 100)}
                        </div>
                      </RecapLine>
                    )
                  }}
                </SubTotalAmount>
              )
            }}
          </TaxesAmount>

          <GiftCardAmount>
            {(props: any) => {
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
            <TotalAmount
              data-testid="total-amount"
              className="text-xl font-extrabold"
            />
          </RecapLineTotal>

          {!appCtx.isComplete && <ReturnToCart cartUrl={appCtx.cartUrl} />}
        </AmountWrapper>
      </TotalWrapper>
    </Wrapper>
  )
}
