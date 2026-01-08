import type { Address } from "@commercelayer/sdk"
import type { ShippingToggleProps } from "components/composite/StepCustomer"
import { AddressInputGroup } from "components/composite/StepCustomer/AddressInputGroup"
import { AppContext } from "components/data/AppProvider"
import { useSettingsOrInvalid } from "components/hooks/useSettingsOrInvalid"
import type { FC } from "react"
import { useContext } from "react"

interface Props {
  billingAddress: NullableType<Address>
  openShippingAddress: (props: ShippingToggleProps) => void

  /**
   * When true: billing is treated as "same as shipping" and MUST NOT block validation.
   * We also allow using shippingAddress values as fallback so fields aren't "empty" in form state.
   */
  isSameAsShipping?: boolean
  shippingAddress?: NullableType<Address>
}

export const BillingAddressFormNew: React.FC<Props> = ({
  billingAddress,
  openShippingAddress,
  isSameAsShipping = false,
  shippingAddress,
}: Props) => {
  const appCtx = useContext(AppContext)
  const { settings } = useSettingsOrInvalid()

  if (!appCtx || !settings) {
    return null
  }

  const { requiresBillingInfo } = appCtx

  const countries = settings?.config?.checkout?.billing_countries
  const defaultCountry = settings?.config?.checkout?.default_country
  const optionalBillingInfo = settings?.config?.checkout?.optional_billing_info
  const optionalCompanyName = settings?.config?.checkout?.optional_company_name

  // If billing is "same as shipping", use shipping as the source of truth for values.
  // Otherwise use billing.
  const src: NullableType<Address> = isSameAsShipping
    ? (shippingAddress ?? billingAddress)
    : billingAddress

  // When same-as-shipping, nothing in billing should block validation.
  const required = !isSameAsShipping

  return (
    <div className="mt-0">
      <Grid>
        <AddressInputGroup
          fieldName="billing_address_first_name"
          resource="billing_address"
          type="text"
          required={required}
          value={src?.first_name || ""}
        />
        <AddressInputGroup
          fieldName="billing_address_last_name"
          resource="billing_address"
          type="text"
          required={required}
          value={src?.last_name || ""}
        />
      </Grid>

      {optionalCompanyName && (
        <AddressInputGroup
          fieldName="billing_address_company"
          resource="billing_address"
          type="text"
          required={false}
          value={src?.company || ""}
        />
      )}

      <AddressInputGroup
        fieldName="billing_address_line_1"
        resource="billing_address"
        type="text"
        required={required}
        value={src?.line_1 || ""}
      />

      <AddressInputGroup
        fieldName="billing_address_line_2"
        resource="billing_address"
        required={false}
        type="text"
        value={src?.line_2 || ""}
      />

      <Grid>
        <AddressInputGroup
          fieldName="billing_address_city"
          resource="billing_address"
          type="text"
          required={required}
          value={src?.city || ""}
        />
        <AddressInputGroup
          fieldName="billing_address_country_code"
          resource="billing_address"
          type="text"
          required={required}
          countries={countries}
          defaultCountry={defaultCountry}
          openShippingAddress={openShippingAddress}
          value={src?.country_code || ""}
        />
      </Grid>

      <Grid>
        <AddressInputGroup
          fieldName="billing_address_phone"
          resource="billing_address"
          type="tel"
          required={required}
          value={src?.phone || ""}
        />
        <AddressInputGroup
          fieldName="billing_address_zip_code"
          resource="billing_address"
          type="text"
          required={required}
          value={src?.zip_code || ""}
        />
      </Grid>

      {(requiresBillingInfo || optionalBillingInfo) && (
        <AddressInputGroup
          fieldName="billing_address_billing_info"
          resource="billing_address"
          required={!!requiresBillingInfo && !isSameAsShipping}
          type="text"
          value={src?.billing_info || ""}
        />
      )}
    </div>
  )
}

const Grid: FC<React.HTMLAttributes<HTMLDivElement>> = (props) => (
  <div {...props} className="grid lg:grid-cols-2 lg:gap-4" />
)
