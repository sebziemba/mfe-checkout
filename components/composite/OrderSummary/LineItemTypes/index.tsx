// components/composite/OrderSummary/LineItemTypes/index.tsx
import { LineItemField } from "@commercelayer/react-components"
import {
  LineItem,
  type TLineItem,
} from "@commercelayer/react-components/line_items/LineItem"
import LineItemAmount from "@commercelayer/react-components/line_items/LineItemAmount"
import LineItemImage from "@commercelayer/react-components/line_items/LineItemImage"
import LineItemName from "@commercelayer/react-components/line_items/LineItemName"
import LineItemOption from "@commercelayer/react-components/line_items/LineItemOption"
import LineItemQuantity from "@commercelayer/react-components/line_items/LineItemQuantity"
import { CronExpressionParser } from "cron-parser"
import cronstrue from "cronstrue"
import { useTranslation } from "next-i18next"
import type React from "react"
import "cronstrue/locales/en"
import "cronstrue/locales/it"
import "cronstrue/locales/de"

import { FlexContainer } from "components/ui/FlexContainer"
import { RepeatIcon } from "../RepeatIcon"

import {
  LineItemDescription,
  LineItemFrequency,
  LineItemQty,
  LineItemTitle,
  LineItemWrapper,
  StyledLineItemOptions,
  StyledLineItemSkuCode,
} from "./styled"

interface Props {
  type: TLineItem
  hideItemCodes?: NullableType<boolean>
  taxIncluded?: boolean
}

const CODE_LOOKUP: { [k: string]: "sku_code" | "bundle_code" | undefined } = {
  skus: "sku_code",
  bundles: "bundle_code",
}

const NL_VAT_RATE = 0.21

function toGrossCents(netCents: number) {
  return Math.round(netCents * (1 + NL_VAT_RATE))
}

function formatMoneyFromCents(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale || "nl-NL", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function isRecord(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

export const LineItemTypes: React.FC<Props> = ({
  type,
  hideItemCodes,
  taxIncluded,
}) => {
  const { t, i18n } = useTranslation()

  return (
    <LineItem type={type}>
      <LineItemWrapper data-testid={`line-items-${type}`}>
        <LineItemImage
          width={85}
          className="self-start p-1 bg-white border rounded-sm"
        />
        <LineItemDescription>
          {!hideItemCodes && <StyledLineItemSkuCode type={CODE_LOOKUP[type]} />}

          <LineItemTitle>
            <LineItemName className="font-medium" />

            {taxIncluded ? (
              <LineItemAmount
                data-testid="line-item-amount"
                className="pl-2 text-lg font-medium"
              />
            ) : (
              <LineItemField attribute="total_amount_cents">
                {({ attributeValue }: { attributeValue?: unknown }) => {
                  const netCents =
                    typeof attributeValue === "number"
                      ? attributeValue
                      : Number(attributeValue ?? 0)

                  const grossCents = toGrossCents(netCents)

                  const currency = "EUR"
                  const locale = i18n.language || "nl-NL"

                  const gross = formatMoneyFromCents(
                    grossCents,
                    currency,
                    locale,
                  )

                  return (
                    <span
                      data-testid="line-item-amount"
                      className="pl-2 text-lg font-medium"
                    >
                      {gross}
                    </span>
                  )
                }}
              </LineItemField>
            )}
          </LineItemTitle>

          <StyledLineItemOptions showAll showName={true} className="options">
            <LineItemOption />
          </StyledLineItemOptions>

          {/* ✅ NEW: show metadata from CL line item */}
          <LineItemField attribute="metadata">
            {({ attributeValue }: { attributeValue?: unknown }) => {
              const md =
                attributeValue &&
                typeof attributeValue === "object" &&
                !Array.isArray(attributeValue)
                  ? (attributeValue as Record<string, any>)
                  : null

              const boxFor =
                md && typeof md.box_for === "string" && md.box_for.trim()
                  ? md.box_for.trim()
                  : ""

              const cardVariant =
                md &&
                typeof md.card_variant === "string" &&
                md.card_variant.trim()
                  ? md.card_variant.trim()
                  : ""

              const cardMessage =
                md &&
                typeof md.card_message === "string" &&
                md.card_message.trim()
                  ? md.card_message.trim()
                  : ""

              if (!boxFor && !cardVariant && !cardMessage) return <></>

              return (
                <div className="mt-1 text-[12px] text-gray-600 whitespace-pre-wrap">
                  {boxFor ? <div>{boxFor}</div> : null}
                  {cardVariant ? (
                    <div>
                      <span className="font-medium">Gekozen variant:</span>{" "}
                      {cardVariant}
                    </div>
                  ) : null}
                  {cardMessage ? (
                    <div className="mt-1">{cardMessage}</div>
                  ) : null}
                </div>
              )
            }}
          </LineItemField>

          <FlexContainer className="flex-col justify-between mt-2 lg:flex-row">
            <LineItemQty>
              <LineItemQuantity>
                {(props) => (
                  <>
                    {!!props.quantity &&
                      t("orderRecap.quantity", { count: props.quantity })}
                  </>
                )}
              </LineItemQuantity>
            </LineItemQty>

            <LineItemField attribute="frequency">
              {/*  @ts-expect-error typing on attribute */}
              {({ attributeValue }) => {
                if (!attributeValue) {
                  return null
                }
                let isCronValid = true
                try {
                  CronExpressionParser.parse(attributeValue as string)
                } catch (_e) {
                  isCronValid = false
                }
                const frequency = isCronValid
                  ? cronstrue.toString(attributeValue as string, {
                      locale: i18n.language,
                    })
                  : t(`orderRecap.frequency.${attributeValue}`)

                return (
                  <LineItemFrequency data-testid="line-items-frequency">
                    <RepeatIcon />
                    {frequency}
                  </LineItemFrequency>
                )
              }}
            </LineItemField>
          </FlexContainer>
        </LineItemDescription>
      </LineItemWrapper>
    </LineItem>
  )
}
