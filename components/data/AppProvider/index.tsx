import {
  CommerceLayer,
  type Order,
  type PaymentMethod,
  type ShippingMethod as ShippingMethodCollection,
} from "@commercelayer/sdk"
import { ActionType, reducer } from "components/data/AppProvider/reducer"
import {
  calculateSettings,
  checkAndSetDefaultAddressForOrder,
  type FetchOrderByIdResponse,
  fetchOrder,
} from "components/data/AppProvider/utils"
import { changeLanguage } from "i18next"
import { createContext, useEffect, useReducer, useRef, useState } from "react"

export interface AppProviderData extends FetchOrderByIdResponse {
  isLoading: boolean
  orderId: string
  order: NullableType<Order>
  accessToken: string
  isGuest: boolean
  slug: string
  domain: string
  isFirstLoading: boolean
  getOrder: (order: Order) => void
  getOrderFromRef: () => Promise<Order>
  setCustomerEmail: (email: string) => void
  setAddresses: (order?: Order) => Promise<void>
  setCouponOrGiftCard: () => Promise<void>
  saveShipments: () => Promise<Order>
  placeOrder: (order?: Order) => Promise<void>
  setPayment: (params: { payment?: PaymentMethod; order?: Order }) => void
  selectShipment: (params: {
    shippingMethod: {
      id: string
    }
    shipmentId: string
    order?: Order
  }) => Promise<void>
  autoSelectShippingMethod: (order?: Order) => Promise<Order>
}

export interface AppStateData extends FetchOrderByIdResponse {
  order?: Order
  isLoading: boolean
  isFirstLoading: boolean
}

const initialState: AppStateData = {
  order: undefined,
  isLoading: true,
  isFirstLoading: true,
  isGuest: false,
  hasCustomerAddresses: false,
  isUsingNewBillingAddress: true,
  isUsingNewShippingAddress: true,
  hasSameAddresses: false,
  hasEmailAddress: false,
  emailAddress: "",
  hasBillingAddress: false,
  billingAddress: undefined,
  requiresBillingInfo: false,
  isShipmentRequired: true,
  shippingAddress: undefined,
  hasShippingMethod: false,
  hasShippingAddress: false,
  shipments: [],
  customerAddresses: [],
  paymentMethod: undefined,
  hasPaymentMethod: false,
  isPaymentRequired: true,
  isCreditCard: false,

  // HARD LOCK: NL only shipping
  shippingCountryCodeLock: "NL",

  isComplete: false,
  returnUrl: "",
  cartUrl: undefined,
  taxIncluded: false,
  shippingMethodName: undefined,
  hasSubscriptions: false,
}

export const AppContext = createContext<AppProviderData | null>(null)

interface AppProviderProps {
  domain: string
  slug: string
  orderId: string
  isGuest: boolean
  isShipmentRequired: boolean
  accessToken: string
  children?: ChildrenType
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  orderId,
  isGuest,
  isShipmentRequired,
  accessToken,
  slug,
  domain,
}) => {
  const orderRef = useRef<Order>()
  const [state, dispatch] = useReducer(reducer, { ...initialState, isGuest })
  const [order, setOrder] = useState<NullableType<Order>>()

  const cl = CommerceLayer({
    organization: slug,
    accessToken,
    domain,
  })

  const NL = "NL" as const

  /**
   * Prevent infinite loops when we auto-sync billing from shipping.
   * We store the last shipping address id we already synced for.
   */
  const billingAutoSyncRef = useRef<string | null>(null)

  /**
   * Fundamental normalization rules for your new flow:
   * 1) Shipping country must be NL only (order-level lock).
   * 2) Billing is optional in UI, but if missing it must equal shipping.
   *    We enforce that at the order source-of-truth.
   */
  const enforceNlShippingLock = async (o: Order): Promise<Order> => {
    const current = (o as any)?.shipping_country_code_lock ?? null
    if (current === NL) return o

    return await cl.orders.update({
      type: "orders",
      id: o.id,
      shipping_country_code_lock: NL,
    } as any)
  }

  const ensureBillingFromShipping = async (o: Order): Promise<Order> => {
    const shipId = (o as any)?.shipping_address?.id as string | undefined
    const billId = (o as any)?.billing_address?.id as string | undefined

    if (shipId && !billId) {
      return await cl.orders.update({
        type: "orders",
        id: o.id,
        _billing_address_same_as_shipping: true,
      } as any)
    }
    return o
  }

  const normalizeOrderForAddresses = async (o: Order): Promise<Order> => {
    const locked = await enforceNlShippingLock(o)
    const normalized = await ensureBillingFromShipping(locked)
    return normalized
  }

  const getOrder = (o: Order) => {
    orderRef.current = o
    setOrder(o)
  }

  const getOrderFromRef = async () => {
    return orderRef.current || (await fetchOrder(cl, orderId))
  }

  const fetchInitialOrder = async (oid?: string, token?: string) => {
    if (!oid || !token) return

    dispatch({ type: ActionType.START_LOADING })

    const rawOrder = await getOrderFromRef()
    const normalizedOrder = await normalizeOrderForAddresses(rawOrder)

    const { shipments, ...addressInfos } =
      await checkAndSetDefaultAddressForOrder({
        cl,
        order: normalizedOrder,
      })

    const orderWithShipments =
      shipments != null
        ? ({ ...normalizedOrder, shipments } as Order)
        : normalizedOrder

    const others = calculateSettings(
      orderWithShipments,
      isShipmentRequired,
      isGuest,
      undefined,
    )

    dispatch({
      type: ActionType.SET_ORDER,
      payload: {
        order: orderWithShipments, // ✅ IMPORTANT: keep shipments you just computed
        others: {
          isShipmentRequired,
          ...others,
          ...addressInfos,
        },
      },
    })

    await changeLanguage(normalizedOrder.language_code ?? "en")
  }

  const setCustomerEmail = (email: string) => {
    dispatch({
      type: ActionType.SET_CUSTOMER_EMAIL,
      payload: { customerEmail: email },
    })
  }

  const setAddresses = async (o?: Order) => {
    dispatch({ type: ActionType.START_LOADING })

    const currentOrder = o ?? (await getOrderFromRef())
    const normalizedOrder = await normalizeOrderForAddresses(currentOrder)

    const others = calculateSettings(
      normalizedOrder,
      isShipmentRequired,
      isGuest,
      state.customerAddresses,
    )

    setTimeout(() => {
      dispatch({
        type: ActionType.SET_ADDRESSES,
        payload: {
          order: normalizedOrder,
          others,
        },
      })
    }, 100)
  }

  const setCouponOrGiftCard = async (o?: Order) => {
    const currentOrder = o ?? (await getOrderFromRef())
    if (state.order) {
      dispatch({ type: ActionType.START_LOADING })

      const others = calculateSettings(
        currentOrder,
        state.isShipmentRequired,
        isGuest,
        state.customerAddresses,
      )
      setTimeout(() => {
        dispatch({
          type: ActionType.CHANGE_COUPON_OR_GIFTCARD,
          payload: { order: currentOrder, others },
        })
      }, 100)
    }
  }

  const selectShipment = async (params: {
    shippingMethod: ShippingMethodCollection | Record<string, any>
    shipmentId: string
    order?: Order
  }) => {
    const currentOrder = params.order ?? (await fetchOrder(cl, orderId))

    const others = calculateSettings(
      currentOrder,
      state.isShipmentRequired,
      isGuest,
      state.customerAddresses,
    )

    dispatch({
      type: ActionType.SELECT_SHIPMENT,
      payload: {
        order: currentOrder,
        others,
        shipment: {
          shippingMethod: params.shippingMethod,
          shipmentId: params.shipmentId,
        },
      },
    })
  }

  const autoSelectShippingMethod = async (o?: Order) => {
    dispatch({ type: ActionType.START_LOADING })
    const currentOrder = o ?? (await fetchOrder(cl, orderId))

    const others = calculateSettings(
      currentOrder,
      state.isShipmentRequired,
      isGuest,
      state.customerAddresses,
    )
    setTimeout(() => {
      dispatch({
        type: ActionType.SAVE_SHIPMENTS,
        payload: { order: currentOrder, others },
      })
    }, 100)

    return currentOrder
  }

  const saveShipments = async () => {
    dispatch({ type: ActionType.START_LOADING })
    const currentOrder = await getOrderFromRef()
    const others = calculateSettings(
      currentOrder,
      state.isShipmentRequired,
      isGuest,
      state.customerAddresses,
    )

    setTimeout(() => {
      dispatch({
        type: ActionType.SAVE_SHIPMENTS,
        payload: { order: currentOrder, others },
      })
    }, 100)

    return currentOrder
  }

  const setPayment = async (params: {
    payment?: PaymentMethod
    order?: Order
  }) => {
    dispatch({ type: ActionType.START_LOADING })
    const currentOrder = params.order ?? (await getOrderFromRef())

    const others = calculateSettings(
      currentOrder,
      state.isShipmentRequired,
      isGuest,
      state.customerAddresses,
    )

    dispatch({
      type: ActionType.SET_PAYMENT,
      payload: { payment: params.payment, order: currentOrder, others },
    })
  }

  const placeOrder = async (o?: Order) => {
    dispatch({ type: ActionType.START_LOADING })
    if (o && o.customer_email != null) {
      setCustomerEmail(o.customer_email)
    }
    const currentOrder = o ?? (await getOrderFromRef())

    dispatch({
      type: ActionType.PLACE_ORDER,
      payload: { order: currentOrder },
    })
  }

  /**
   * IMPORTANT:
   * Auto-sync billing from shipping as soon as shipping exists (and billing doesn't).
   * This unblocks the MFE checkout validity rules that otherwise require billing.
   */
  useEffect(() => {
    const o = (orderRef.current ?? state.order ?? order) as any
    if (!o) return
    if (!isShipmentRequired) return

    const shipId = o?.shipping_address?.id as string | undefined
    const billId = o?.billing_address?.id as string | undefined
    if (!shipId || billId) return

    // Avoid re-running for the same shipping address id
    if (billingAutoSyncRef.current === shipId) return
    billingAutoSyncRef.current = shipId

    ;(async () => {
      try {
        const updated = await cl.orders.update({
          type: "orders",
          id: o.id,
          _billing_address_same_as_shipping: true,
        } as any)

        // Also ensure NL lock stays enforced
        const locked = await enforceNlShippingLock(updated)

        // Recompute flags and push them to reducer so UI unlocks immediately
        const others = calculateSettings(
          locked,
          isShipmentRequired,
          isGuest,
          state.customerAddresses,
        )

        dispatch({
          type: ActionType.SET_ADDRESSES,
          payload: { order: locked, others },
        })

        // Keep refs/state consistent
        orderRef.current = locked
        setOrder(locked)
      } catch (e) {
        // Don't crash the checkout; user can still fill billing manually if needed.
        // eslint-disable-next-line no-console
        console.error("Auto-sync billing from shipping failed:", e)
      }
    })()
    // We intentionally depend on address IDs, not whole objects, to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isShipmentRequired,
    isGuest,
    state.customerAddresses,
    (state.order as any)?.shipping_address?.id,
    (state.order as any)?.billing_address?.id,
    (order as any)?.shipping_address?.id,
    (order as any)?.billing_address?.id,
  ])

  useEffect(() => {
    const unsubscribe = () => {
      fetchInitialOrder(orderId, accessToken)
    }
    return unsubscribe()
  }, [orderId, accessToken])

  return (
    <AppContext.Provider
      value={{
        ...state,
        cartUrl: state.cartUrl?.replace(":slug", slug),
        orderId,
        order,
        accessToken,
        isGuest,
        slug,
        domain,
        getOrderFromRef,
        setAddresses,
        selectShipment,
        getOrder,
        saveShipments,
        setPayment,
        setCouponOrGiftCard,
        placeOrder,
        setCustomerEmail,
        autoSelectShippingMethod,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
