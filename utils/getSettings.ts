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

function dbg(enabled: boolean, ...args: any[]) {
  if (!enabled) return
  console.error(...args)
}

function serializeApiError(e: any) {
  return {
    name: e?.name,
    message: e?.message,
    status: e?.status || e?.response?.status,
    errors: e?.errors || e?.response?.errors,
    data: e?.response?.data,
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

async function retryCall<T>(
  f: () => Promise<T>,
  debug?: boolean,
  label?: string,
): Promise<FetchResource<T> | undefined> {
  return await retry(
    async (_bail, number) => {
      try {
        const object = await f()
        return { object: object as unknown as T, success: true }
      } catch (e: unknown) {
        if (CommerceLayerStatic.isApiError(e) && (e as any).status === 401) {
          dbg(
            !!debug,
            `[getSettings] ${label || "call"} Not authorized (401)`,
            serializeApiError(e),
          )
          return { object: undefined, success: false, bailed: true }
        }
        if (number === RETRIES + 1) {
          dbg(
            !!debug,
            `[getSettings] ${label || "call"} failed after retries`,
            serializeApiError(e),
          )
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
  debug?: boolean,
): Promise<FetchResource<Organization> | undefined> {
  return retryCall<Organization>(
    () =>
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
    debug,
    "organization.retrieve",
  )
}

function getOrder(
  cl: CommerceLayerClient,
  orderId: string,
  debug?: boolean,
): Promise<FetchResource<Order> | undefined> {
  return retryCall<Order>(
    () =>
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
    debug,
    "orders.retrieve",
  )
}

function getTokenInfo(accessToken: string) {
  try {
    const { payload } = jwtDecode(accessToken) as any

    const slug = payload?.organization?.slug
    const kind = payload?.application?.kind
    const test = payload?.test
    const owner = payload?.owner

    return {
      slug,
      kind,
      isTest: !!test,
      owner,
      isGuest: !owner,
      scope: payload?.scope,
      orgId: payload?.organization?.id,
      appId: payload?.application?.id,
      clientId: payload?.application?.client_id,
    }
  } catch (e) {
    console.error(`[getSettings] error decoding access token: ${e}`)
    return {}
  }
}

export const getSettings = async ({
  accessToken,
  orderId,
  subdomain, // unused with custom domain, kept for signature compatibility
  paymentReturn,
  debug = false,
}: {
  accessToken: string
  orderId: string
  paymentReturn?: boolean
  subdomain: string
  debug?: boolean
}) => {
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "commercelayer.io"

  function invalidateCheckout(
    reason: string,
    retry?: boolean,
  ): InvalidCheckoutSettings {
    console.error("[getSettings] INVALID CHECKOUT:", reason)
    return {
      validCheckout: false,
      retryOnError: !!retry,
      ...({ debugReason: reason } as any),
    } as any
  }

  dbg(debug, "[getSettings] start", {
    orderId,
    hasToken: !!accessToken,
    tokenPrefix: accessToken ? accessToken.slice(0, 16) : null,
    tokenLen: accessToken ? accessToken.length : 0,
    paymentReturn: !!paymentReturn,
    subdomain,
    domain,
  })

  if (!accessToken || !orderId) {
    return invalidateCheckout("missing_accessToken_or_orderId")
  }

  const tokenInfo = getTokenInfo(accessToken) as any
  dbg(debug, "[getSettings] tokenInfo", tokenInfo)

  const { slug, kind, isTest, isGuest, owner } = tokenInfo

  if (!slug || !kind) {
    return invalidateCheckout("token_missing_slug_or_kind")
  }

  const expectedSlug = (process.env.NEXT_PUBLIC_CL_SLUG || "").trim()
  if (isProduction() && expectedSlug && slug !== expectedSlug) {
    dbg(debug, "[getSettings] slug mismatch", { expectedSlug, slug })
    return invalidateCheckout("token_slug_mismatch")
  }

  if (String(kind) !== "sales_channel") {
    dbg(debug, "[getSettings] token kind rejected", { kind })
    return invalidateCheckout(`token_kind_not_sales_channel (${String(kind)})`)
  }

  dbg(debug, "[getSettings] creating CL client", {
    organization: slug,
    domain,
    endpoint: `https://${slug}.${domain}`,
  })

  const cl = CommerceLayer({
    organization: slug,
    accessToken,
    domain,
  })

  dbg(debug, "[getSettings] fetching organization + order", { orderId })

  let organizationResource: FetchResource<Organization> | undefined
  let orderResource: FetchResource<Order> | undefined

  try {
    ;[organizationResource, orderResource] = await Promise.all([
      getOrganization(cl, debug),
      getOrder(cl, orderId, debug),
    ])
  } catch (e: any) {
    dbg(debug, "[getSettings] Promise.all threw", serializeApiError(e))
    return invalidateCheckout("promise_all_threw", true)
  }

  dbg(debug, "[getSettings] organizationResource", organizationResource)
  dbg(debug, "[getSettings] orderResource", orderResource)

  const organization = organizationResource?.object
  if (!organizationResource?.success || !organization?.id) {
    return invalidateCheckout(
      "organization_not_accessible",
      !organizationResource?.bailed,
    )
  }

  const order = orderResource?.object
  if (!orderResource?.success || !order?.id) {
    return invalidateCheckout("order_not_accessible", !orderResource?.bailed)
  }

  const orderMarketId = (order as any)?.market?.id as string | undefined
  dbg(debug, "[getSettings] order basics", {
    id: order.id,
    status: (order as any).status,
    marketId: orderMarketId,
    customerId: (order as any)?.customer?.id,
    guest: (order as any)?.guest,
    orderTokenPrefix: (order as any)?.token
      ? String((order as any).token).slice(0, 10) + "…"
      : null,
  })

  const lineItemsShoppable = order.line_items?.filter((line_item: any) =>
    LINE_ITEMS_SHOPPABLE.includes(line_item?.item_type as TypeAccepted),
  )

  if ((lineItemsShoppable || []).length === 0) {
    return invalidateCheckout("no_shoppable_line_items")
  }

  const isShipmentRequired = (order.line_items || []).some((line_item: any) => {
    const itemType = line_item?.item_type as TypeAccepted
    const doNotShip = Boolean(line_item?.item?.do_not_ship)
    return LINE_ITEMS_SHIPPABLE.includes(itemType) && !doNotShip
  })

  if (order.status === "draft" || order.status === "pending") {
    if (!paymentReturn && (!order.autorefresh || (!isGuest && order.guest))) {
      try {
        dbg(debug, "[getSettings] refreshing order", {
          orderId: order.id,
          autorefresh: (order as any).autorefresh,
          isGuest,
          orderGuest: (order as any).guest,
        })
        await cl.orders.update({
          id: order.id,
          _refresh: true,
          payment_method: cl.payment_methods.relationship(null),
          ...(!order.autorefresh && { autorefresh: true }),
        })
      } catch (e) {
        dbg(debug, "[getSettings] error refreshing order", serializeApiError(e))
      }
    }
  } else if (
    order.status !== "placed" &&
    (isGuest || owner?.id !== order.customer?.id)
  ) {
    dbg(debug, "[getSettings] ownership/status check failed", {
      orderStatus: (order as any).status,
      isGuest,
      ownerId: owner?.id,
      orderCustomerId: (order as any)?.customer?.id,
    })
    return invalidateCheckout("owner_mismatch_or_invalid_status")
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

  dbg(debug, "[getSettings] success → validCheckout true", {
    orderId: appSettings.orderId,
    orderNumber: appSettings.orderNumber,
    isGuest: appSettings.isGuest,
    endpoint: appSettings.endpoint,
  })

  return appSettings
}
