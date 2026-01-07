import AddressesContainer from "@commercelayer/react-components/addresses/AddressesContainer"
import BillingAddressForm from "@commercelayer/react-components/addresses/BillingAddressForm"
import SaveAddressesButton from "@commercelayer/react-components/addresses/SaveAddressesButton"
import ShippingAddressForm from "@commercelayer/react-components/addresses/ShippingAddressForm"
import type { Address, Order } from "@commercelayer/sdk"
import type { ShippingToggleProps } from "components/composite/StepCustomer"
import { ButtonCss, ButtonWrapper } from "components/ui/Button"
import { SpinnerIcon } from "components/ui/SpinnerIcon"
import { Toggle } from "components/ui/Toggle"
import {
  type Dispatch,
  Fragment,
  type SetStateAction,
  useEffect,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { AddressSectionEmail } from "./AddressSectionEmail"
import { AddressSectionSaveForm } from "./AddressSectionSaveForm"
import { AddressSectionTitle } from "./AddressSectionTitle"
import { BillingAddressFormNew } from "./BillingAddressFormNew"
import { ShippingAddressFormNew } from "./ShippingAddressFormNew"

interface Props {
  billingAddress: NullableType<Address>
  shippingAddress: NullableType<Address>
  emailAddress: NullableType<string>
  hasSameAddresses: boolean
  isShipmentRequired: boolean
  isLocalLoader: boolean

  shipToDifferentAddress: boolean
  setShipToDifferentAddress: Dispatch<SetStateAction<boolean>>

  openShippingAddress: (props: ShippingToggleProps) => void
  disabledShipToDifferentAddress: boolean

  setCustomerEmail: (email: string) => void
  handleSave: (params: { success: boolean; order?: Order }) => void
}

export const CheckoutAddresses: React.FC<Props> = ({
  billingAddress,
  shippingAddress,
  emailAddress,
  // hasSameAddresses,
  isShipmentRequired,
  isLocalLoader,

  shipToDifferentAddress,
  setShipToDifferentAddress,

  // openShippingAddress,
  // disabledShipToDifferentAddress,
  setCustomerEmail,
  handleSave,
}: Props) => {
  const { t } = useTranslation()

  /**
   * IMPORTANT:
   * We keep your existing state name `shipToDifferentAddress`,
   * but UI-wise it now means "Use a different billing address".
   */
  const billToDifferentAddress = shipToDifferentAddress

  const noopOpenShippingAddress = (_: any) => {}

  const [shippingAddressFill, setShippingAddressFill] =
    useState<NullableType<Address>>(shippingAddress)

  // (Optional) if you want to reset billing when toggling on, you can
  // add billingAddressFill state. For now we keep using `billingAddress` as-is.

  const handleToggleDifferentBilling = () => {
    const next = !billToDifferentAddress
    setShipToDifferentAddress(next)
    // If user turns OFF different billing, we don't need any extra state.
    // If user turns ON, billing form appears.
  }

  // Keep shipping fill updated if prop changes
  useEffect(() => {
    setShippingAddressFill(shippingAddress)
  }, [shippingAddress])

  return (
    <Fragment>
      <AddressSectionEmail
        emailAddress={emailAddress}
        setCustomerEmail={setCustomerEmail}
      />

      {/* Keep CL container prop; it just needs the boolean */}
      <AddressesContainer shipToDifferentAddress={billToDifferentAddress}>
        {/* 1) SHIPPING FIRST */}
        {isShipmentRequired && (
          <div className="mt-4">
            <AddressSectionTitle data-testid="shipping-address">
              <>{t("addressForm.shipping_address_title")}</>
            </AddressSectionTitle>

            <ShippingAddressForm autoComplete="on" errorClassName="hasError">
              <div className="mt-4">
                <ShippingAddressFormNew shippingAddress={shippingAddressFill} />
              </div>
            </ShippingAddressForm>
          </div>
        )}

        {/* 2) TOGGLE OPTIONAL BILLING */}
        <div className="mt-4">
          <Toggle
            // Billing should always be possible; don’t disable this based on shipping lock.
            // If you still want to disable sometimes, wire a separate prop.
            disabled={false}
            data-testid="button-bill-to-different-address"
            data-status={billToDifferentAddress}
            label={
              t("addressForm.use_different_billing_address") ||
              "Use a different billing address"
            }
            checked={billToDifferentAddress}
            onChange={handleToggleDifferentBilling}
          />
        </div>

        {/* 3) BILLING ONLY IF TOGGLED ON */}
        {billToDifferentAddress && (
          <div className="mt-4">
            <AddressSectionTitle data-testid="billing-address">
              <>{t("addressForm.billing_address_title")}</>
            </AddressSectionTitle>

            <BillingAddressForm autoComplete="on" errorClassName="hasError">
              <div className="mt-4">
                <BillingAddressFormNew
                  billingAddress={billingAddress}
                  openShippingAddress={noopOpenShippingAddress}
                />
              </div>
            </BillingAddressForm>
          </div>
        )}

        {/* Save */}
        <AddressSectionSaveForm>
          <ButtonWrapper>
            <SaveAddressesButton
              className={ButtonCss}
              disabled={isLocalLoader}
              label={
                <>
                  {isLocalLoader && <SpinnerIcon />}
                  {isShipmentRequired
                    ? t("stepCustomer.continueToDelivery")
                    : t("stepShipping.continueToPayment")}
                </>
              }
              data-testid="save-customer-button"
              onClick={handleSave}
            />
          </ButtonWrapper>
        </AddressSectionSaveForm>
      </AddressesContainer>
    </Fragment>
  )
}
