// utils/vat.ts
export const NL_VAT_RATE = 0.21

export function cents(n: number) {
  return Math.round(n)
}

// subtotalCents is integer cents
export function estimateVatCents(subtotalCents: number) {
  return cents(subtotalCents * NL_VAT_RATE)
}
