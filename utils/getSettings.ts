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
          console.log("[checkout/getSettings] Not authorized (401)")
          return { object: undefined, success: false, bailed: true }
        }
        if (number === RETRIES + 1) {
          console.log("[checkout/getSettings] Retries exhausted")
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
    const kind = payload?.application?.kind as string | undefined // sales_channel | integration
    const test = !!payload?.test
    const owner = payload?.owner
    const scope = payload?.scope

    return {
      slug,
      kind,
      isTest: test,
      owner,
      isGuest: !owner,
      scope,
    }
  } catch (e) {
    console.log(
      `[checkout/getSettings] error decoding access token: ${String(e)}`,
    )
    return {}
  }
}

export const getSettings = async ({
  accessToken,
  orderId,
  subdomain, // kept for signature compatibility
  paymentReturn,
}: {
  accessToken: string
  orderId: string
  paymentReturn?: boolean
  subdomain: string
}) => {
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "commercelayer.io"

  function invalidateCheckout(
    reason: string,
    retry?: boolean,
  ): InvalidCheckoutSettings {
    console.log("[checkout/getSettings] INVALID", {
      reason,
      retryOnError: !!retry,
    })
    return {
      validCheckout: false,
      retryOnError: !!retry,
    } as InvalidCheckoutSettings
  }

  if (!accessToken || !orderId)
    return invalidateCheckout("missing accessToken or orderId")

  const { slug, kind, isTest, isGuest, owner, scope } =
    getTokenInfo(accessToken)

  console.log("[checkout/getSettings] token info", {
    slug,
    kind,
    isTest,
    isGuest,
    scope,
    orderId,
  })

  if (!slug || !kind) return invalidateCheckout("token missing slug/kind")

  // ✅ Security check for custom domain: lock slug in PROD (optional but recommended)
  // Set NEXT_PUBLIC_CL_SLUG=bubbels-van-frits-2 in checkout app env
  const expectedSlug = (process.env.NEXT_PUBLIC_CL_SLUG || "").trim()
  if (isProduction() && expectedSlug && slug !== expectedSlug) {
    return invalidateCheckout("slug mismatch in production")
  }

  // ✅ Allow both token kinds (your current flow passes integration token)
  if (kind !== "sales_channel" && kind !== "integration") {
    return invalidateCheckout(`unsupported token kind: ${String(kind)}`)
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
    return invalidateCheckout(
      "organization retrieve failed",
      !organizationResource?.bailed,
    )
  }

  const order = orderResource?.object
  if (!orderResource?.success || !order?.id) {
    return invalidateCheckout("order retrieve failed", !orderResource?.bailed)
  }

  // ✅ market id from the ORDER (works with market:all + integration)
  const orderMarketId = (order as any)?.market?.id as string | undefined
  console.log("[checkout/getSettings] order ok", {
    orderId: order.id,
    status: order.status,
    orderMarketId,
  })

  const lineItemsShoppable = order.line_items?.filter((li) =>
    LINE_ITEMS_SHOPPABLE.includes(li.item_type as TypeAccepted),
  )

  if ((lineItemsShoppable || []).length === 0) {
    return invalidateCheckout("no shoppable line items")
  }

  const isShipmentRequired = (order.line_items || []).some(
    (li) =>
      LINE_ITEMS_SHIPPABLE.includes(li.item_type as TypeAccepted) &&
      // @ts-expect-error
      !li.item?.do_not_ship,
  )

  // Refresh logic (same as upstream)
  if (order.status === "draft" || order.status === "pending") {
    if (!paymentReturn && (!order.autorefresh || (!isGuest && order.guest))) {
      try {
        await cl.orders.update({
          id: order.id,
          _refresh: true,
          payment_method: cl.payment_methods.relationship(null),
          ...(!order.autorefresh && { autorefresh: true }),
        })
      } catch (e) {
        console.log("[checkout/getSettings] error refreshing order", e)
      }
    }
  } else if (order.status !== "placed") {
    // Ownership check only makes sense for sales_channel customer/guest tokens.
    // Integration tokens have no owner → do not block.
    if (
      kind === "sales_channel" &&
      (isGuest || owner?.id !== order.customer?.id)
    ) {
      return invalidateCheckout("sales_channel ownership check failed")
    }
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
