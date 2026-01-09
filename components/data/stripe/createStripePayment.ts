import { CommerceLayer, type StripePayment } from "@commercelayer/sdk"

export async function createStripePaymentForOrder(params: {
  organization: string
  domain: string
  accessToken: string
  orderId: string
}) {
  const cl = CommerceLayer({
    organization: params.organization,
    domain: params.domain,
    accessToken: params.accessToken,
  })

  // 1) Create stripe_payment with explicit method types including iDEAL
  const sp = await cl.stripe_payments.create({
    order: { type: "orders", id: params.orderId },
    return_url: window.location.href,
    options: {
      // ✅ Explicitly include iDEAL
      payment_method_types: ["ideal", "card", "paypal", "revolut_pay"],

      // ✅ Prevent off_session save behavior from excluding redirect methods
      payment_method_options: {
        card: { setup_future_usage: "none" },
        paypal: { setup_future_usage: "none" },
      },
    },
  } as any)

  // 2) Attach it as payment_source (so the order uses THIS payment intent)
  await cl.orders.update({
    id: params.orderId,
    payment_source: { type: "stripe_payments", id: (sp as any).id },
  } as any)

  return sp as StripePayment
}
