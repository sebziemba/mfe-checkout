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
  isShipmentRequired,
  isLocalLoader,
  shipToDifferentAddress,
  setShipToDifferentAddress,
  setCustomerEmail,
  handleSave,
}: Props) => {
  const { t } = useTranslation()

  // toggle now means: "Use a different billing address"
  const billToDifferentAddress = shipToDifferentAddress

  const [shippingAddressFill, setShippingAddressFill] =
    useState<NullableType<Address>>(shippingAddress)

  useEffect(() => {
    setShippingAddressFill(shippingAddress)
  }, [shippingAddress])

  const handleToggleDifferentBilling = () => {
    setShipToDifferentAddress(!billToDifferentAddress)
  }

  const noopOpenShippingAddress = (_: any) => {}

  return (
    <Fragment>
      <AddressSectionEmail
        emailAddress={emailAddress}
        setCustomerEmail={setCustomerEmail}
      />

      {/* When shipment is required, CL must treat shipping as enabled/validated */}
      <AddressesContainer shipToDifferentAddress={!!isShipmentRequired}>
        {/* SHIPPING FIRST */}
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

        {/* Toggle: different BILLING */}
        <div className="mt-4">
          <Toggle
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

        {/* Visible BILLING only if toggled ON */}
        {billToDifferentAddress && (
          <div className="mt-4">
            <AddressSectionTitle data-testid="billing-address">
              <>{t("addressForm.billing_address_title")}</>
            </AddressSectionTitle>

            <BillingAddressForm autoComplete="on" errorClassName="hasError">
              <div className="mt-4">
                <BillingAddressFormNew
                  billingAddress={billingAddress}
                  shippingAddress={shippingAddressFill}
                  isSameAsShipping={false}
                  openShippingAddress={noopOpenShippingAddress}
                />
              </div>
            </BillingAddressForm>
          </div>
        )}

        {/* Hidden BILLING (still mounted) when toggled OFF:
            does NOT block validation and uses shipping as fallback values */}
        {!billToDifferentAddress && (
          <div className="hidden">
            <BillingAddressForm autoComplete="on" errorClassName="hasError">
              <BillingAddressFormNew
                billingAddress={billingAddress}
                shippingAddress={shippingAddressFill}
                isSameAsShipping={true}
                openShippingAddress={noopOpenShippingAddress}
              />
            </BillingAddressForm>
          </div>
        )}

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
