import { jwtDecode } from "@commercelayer/js-auth"
import { getMfeConfig } from "@commercelayer/organization-config"
import CommerceLayer, {
  type CommerceLayerClient,
  CommerceLayerStatic,
  type Order,
  type Organization,
} from "@commercelayer/sdk"
import retry from "async-retry"

import type { TypeAccepted } from "components/data/AppProvider/utils"
import {
  LINE_ITEMS_SHIPPABLE,
  LINE_ITEMS_SHOPPABLE,
} from "components/utils/constants"

const RETRIES = 2

interface FetchResource<T> {
  object: T | undefined
  success: boolean
  bailed?: boolean
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

async function retryCall<T>(
  f: () => Promise<T>,
): Promise<FetchResource<T> | undefined> {
  return await retry(
    async (_bail, number) => {
      try {
        const object = await f()
        return { object: object as unknown as T, success: true }
      } catch (e: unknown) {
        if (CommerceLayerStatic.isApiError(e) && e.status === 401) {
          console.log("Not authorized")
          return { object: undefined, success: false, bailed: true }
        }
        if (number === RETRIES + 1) {
          return { object: undefined, success: false, bailed: false }
        }
        throw e
      }
    },
    { retries: RETRIES },
  )
}

function getOrganization(
  cl: CommerceLayerClient,
): Promise<FetchResource<Organization> | undefined> {
  return retryCall<Organization>(() =>
    cl.organization.retrieve({
      fields: {
        organizations: [
          "id",
          "logo_url",
          "name",
          "primary_color",
          "favicon_url",
          "gtm_id",
          "gtm_id_test",
          "support_email",
          "support_phone",
          "config",
        ],
      },
    }),
  )
}

function getOrder(
  cl: CommerceLayerClient,
  orderId: string,
): Promise<FetchResource<Order> | undefined> {
  return retryCall<Order>(() =>
    cl.orders.retrieve(orderId, {
      fields: {
        orders: [
          "id",
          "market",
          "autorefresh",
          "status",
          "number",
          "guest",
          "token",
          "language_code",
          "terms_url",
          "privacy_url",
          "line_items",
          "expires_at",
          "expiration_info",
          "customer",
          "payment_status",
        ],
        line_items: ["item_type", "item"],
      },
      include: ["market", "line_items", "line_items.item", "customer"],
    }),
  )
}

function getTokenInfo(accessToken: string) {
  try {
    const { payload } = jwtDecode(accessToken) as any

    const slug = payload?.organization?.slug as string | undefined
    const kind = payload?.application?.kind as string | undefined // must be "sales_channel"
    const test = payload?.test
    const owner = payload?.owner

    return {
      slug,
      kind,
      isTest: !!test,
      owner,
      isGuest: !owner,
      scope: payload?.scope,
    }
  } catch (e) {
    console.log(`error decoding access token: ${e}`)
    return {}
  }
}

export const getSettings = async ({
  accessToken,
  orderId,
  paymentReturn,
}: {
  accessToken: string
  orderId: string
  paymentReturn?: boolean
  subdomain: string // kept for signature compatibility, but not used
}) => {
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "commercelayer.io"

  function invalidateCheckout(retry?: boolean): InvalidCheckoutSettings {
    return {
      validCheckout: false,
      retryOnError: !!retry,
    } as InvalidCheckoutSettings
  }

  if (!accessToken || !orderId) return invalidateCheckout()

  const { slug, kind, isTest, isGuest, owner } = getTokenInfo(accessToken)

  if (!slug || !kind) return invalidateCheckout()

  /**
   * ✅ Production safety: make sure token belongs to the org you expect.
   * Set NEXT_PUBLIC_CL_SLUG=bubbels-van-frits-2 in the CHECKOUT app env (Vercel).
   */
  const expectedSlug = (process.env.NEXT_PUBLIC_CL_SLUG || "").trim()
  if (isProduction() && expectedSlug && slug !== expectedSlug) {
    return invalidateCheckout()
  }

  /**
   * ✅ OPTION A: Checkout MFE must run with a SALES CHANNEL token.
   * Integration tokens are NOT allowed here (that’s exactly what caused your 404).
   */
  if (kind !== "sales_channel") {
    return invalidateCheckout()
  }

  const cl = CommerceLayer({
    organization: slug,
    accessToken,
    domain,
  })

  const [organizationResource, orderResource] = await Promise.all([
    getOrganization(cl),
    getOrder(cl, orderId),
  ])

  const organization = organizationResource?.object
  if (!organizationResource?.success || !organization?.id) {
    console.log("Invalid: organization")
    return invalidateCheckout(!organizationResource?.bailed)
  }

  const order = orderResource?.object
  if (!orderResource?.success || !order?.id) {
    console.log("Invalid: order")
    return invalidateCheckout(!orderResource?.bailed)
  }

  // ✅ IMPORTANT: market id comes from the ORDER (works with market:all sales channel tokens)
  const orderMarketId = (order as any)?.market?.id as string | undefined

  const lineItemsShoppable = order.line_items?.filter((line_item) =>
    LINE_ITEMS_SHOPPABLE.includes(line_item.item_type as TypeAccepted),
  )

  if ((lineItemsShoppable || []).length === 0) {
    console.log("Invalid: No shoppable line items")
    return invalidateCheckout()
  }

  const isShipmentRequired = (order.line_items || []).some(
    (line_item) =>
      LINE_ITEMS_SHIPPABLE.includes(line_item.item_type as TypeAccepted) &&
      // @ts-expect-error
      !line_item.item?.do_not_ship,
  )

  if (order.status === "draft" || order.status === "pending") {
    // https://github.com/commercelayer/mfe-checkout/issues/356
    if (!paymentReturn && (!order.autorefresh || (!isGuest && order.guest))) {
      try {
        await cl.orders.update({
          id: order.id,
          _refresh: true,
          payment_method: cl.payment_methods.relationship(null),
          ...(!order.autorefresh && { autorefresh: true }),
        })
      } catch {
        console.log("error refreshing order")
      }
    }
  } else if (
    order.status !== "placed" &&
    // Invalid if status not placed with guest token OR if owned order doesn't match the token owner
    (isGuest || owner?.id !== order.customer?.id)
  ) {
    return invalidateCheckout()
  }

  const appSettings: CheckoutSettings = {
    accessToken,
    endpoint: `https://${slug}.${domain}`,
    isGuest: !!isGuest,
    domain,
    slug,

    orderNumber: order.number || "",
    orderId: order.id,
    expiresAt: order.expires_at,
    expirationInfo: order.expiration_info,
    isShipmentRequired,
    validCheckout: true,

    logoUrl: organization.logo_url,
    companyName: organization.name || "Test company",
    language: order.language_code || "en",
    primaryColor: organization.primary_color || "#000000",
    favicon:
      organization.favicon_url ||
      "https://data.commercelayer.app/assets/images/favicons/favicon-32x32.png",
    gtmId: isTest ? organization.gtm_id_test : organization.gtm_id,
    supportEmail: organization.support_email,
    supportPhone: organization.support_phone,
    termsUrl: order.terms_url,
    privacyUrl: order.privacy_url,

    config: getMfeConfig({
      jsonConfig: organization.config ?? {},
      market: orderMarketId ? `market:id:${orderMarketId}` : undefined,
      params: {
        lang: order.language_code,
        orderId: order.id,
        token: order.token,
        slug,
        accessToken,
      },
    }),
  }

  return appSettings
}
