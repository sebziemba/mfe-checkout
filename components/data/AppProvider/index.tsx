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
   * Fundamental normalization rules for your new flow:
   * 1) Shipping country must be NL only (order-level lock).
   * 2) Billing is optional in UI, but if missing it must equal shipping.
   *    We enforce that at the order source-of-truth.
   */
  const enforceNlShippingLock = async (o: Order): Promise<Order> => {
    // Some SDK typings may not include this field; keep it safe.
    const current = (o as any)?.shipping_country_code_lock ?? null
    if (current === NL) return o

    return await cl.orders.update({
      type: "orders",
      id: o.id,
      shipping_country_code_lock: NL,
    } as any)
  }

  const ensureBillingFromShipping = async (o: Order): Promise<Order> => {
    const hasShip = !!(o as any)?.shipping_address?.id
    const hasBill = !!(o as any)?.billing_address?.id
    if (hasShip && !hasBill) {
      // Commerce Layer trigger: clone billing = shipping
      return await cl.orders.update({
        type: "orders",
        id: o.id,
        _billing_address_same_as_shipping: true,
      } as any)
    }
    return o
  }

  const normalizeOrderForAddresses = async (o: Order): Promise<Order> => {
    // Always enforce NL lock first, then ensure billing
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

    // fetch + normalize once on initial load
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
        order: normalizedOrder,
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

    // Use returned order from SaveAddressesButton if present; otherwise refetch.
    const currentOrder = o ?? (await getOrderFromRef())

    // Normalize: NL lock + billing-from-shipping if missing
    const normalizedOrder = await normalizeOrderForAddresses(currentOrder)

    const others = calculateSettings(
      normalizedOrder,
      isShipmentRequired,
      // FIX We are using customer addresses saved in reducer because
      // we don't receive them from fetchOrder
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
    // TODO Remove after fixing components
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
