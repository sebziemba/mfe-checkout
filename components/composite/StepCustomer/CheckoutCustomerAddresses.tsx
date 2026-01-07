import AddressesContainer from "@commercelayer/react-components/addresses/AddressesContainer"
import BillingAddressContainer from "@commercelayer/react-components/addresses/BillingAddressContainer"
import BillingAddressForm from "@commercelayer/react-components/addresses/BillingAddressForm"
import SaveAddressesButton from "@commercelayer/react-components/addresses/SaveAddressesButton"
import ShippingAddressContainer from "@commercelayer/react-components/addresses/ShippingAddressContainer"
import ShippingAddressForm from "@commercelayer/react-components/addresses/ShippingAddressForm"
import type { Address, Order } from "@commercelayer/sdk"
import { Transition } from "@headlessui/react"
import { AddButton } from "components/ui/AddButton"
import { ButtonCss, ButtonWrapper } from "components/ui/Button"
import { CustomerAddressCard } from "components/ui/CustomerAddressCard"
import { GridContainer } from "components/ui/GridContainer"
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

import { AddressFormBottom } from "./AddressFormBottom"
import { AddressSectionEmail } from "./AddressSectionEmail"
import { AddressSectionSaveForm } from "./AddressSectionSaveForm"
import { AddressSectionTitle } from "./AddressSectionTitle"
import { BillingAddressFormNew } from "./BillingAddressFormNew"
import { ShippingAddressFormNew } from "./ShippingAddressFormNew"

interface Props {
  billingAddress: NullableType<Address>
  shippingAddress: NullableType<Address>
  hasSameAddresses: boolean
  isShipmentRequired: boolean
  isUsingNewBillingAddress: boolean
  isUsingNewShippingAddress: boolean
  hasCustomerAddresses: boolean
  emailAddress: NullableType<string>
  isLocalLoader: boolean
  shippingCountryCodeLock: NullableType<string>
  shipToDifferentAddress: boolean
  setShipToDifferentAddress: Dispatch<SetStateAction<boolean>>
  openShippingAddress: (props: any) => void
  disabledShipToDifferentAddress: boolean
  handleSave: (params: { success: boolean; order?: Order }) => void
}

type AddressTypeEnum = "shipping" | "billing"

export const CheckoutCustomerAddresses: React.FC<Props> = ({
  billingAddress,
  shippingAddress,
  isUsingNewBillingAddress,
  isUsingNewShippingAddress,
  isShipmentRequired,
  hasSameAddresses,
  hasCustomerAddresses,
  emailAddress,
  isLocalLoader,
  // shippingCountryCodeLock,
  shipToDifferentAddress,
  setShipToDifferentAddress,
  openShippingAddress,
  disabledShipToDifferentAddress,
  handleSave,
}: Props) => {
  const { t } = useTranslation()

  /**
   * NOTE:
   * We are reusing the existing prop/state name `shipToDifferentAddress`
   * but UI-wise this toggle now means "Use a different billing address".
   * (Shipping is the primary address shown first.)
   */
  const billToDifferentAddress = shipToDifferentAddress

  const [billingAddressFill, setBillingAddressFill] = useState(billingAddress)
  const [shippingAddressFill, setShippingAddressFill] =
    useState(shippingAddress)

  const [showBillingAddressForm, setShowBillingAddressForm] = useState<boolean>(
    isUsingNewBillingAddress,
  )
  const [mountBillingAddressForm, setMountBillingAddressForm] = useState(
    isUsingNewBillingAddress,
  )

  const [showShippingAddressForm, setShowShippingAddressForm] = useState(
    isUsingNewShippingAddress,
  )
  const [mountShippingAddressForm, setMountShippingAddressForm] = useState(
    isUsingNewShippingAddress,
  )

  // When user toggles "different billing" ON and there is no address book,
  // show billing form; if addresses were same, reset billing so they can fill it.
  useEffect(() => {
    if (billToDifferentAddress && !hasCustomerAddresses) {
      if (hasSameAddresses) {
        setBillingAddressFill(undefined)
      }
      setShowBillingAddressForm(true)
      setMountBillingAddressForm(true)
    }

    // When toggling OFF, hide billing form (billing becomes same as shipping).
    if (!billToDifferentAddress) {
      setMountBillingAddressForm(false)
      setShowBillingAddressForm(false)
    }
  }, [billToDifferentAddress, hasCustomerAddresses, hasSameAddresses])

  const handleScroll = (type: AddressTypeEnum) => {
    const tab = document
      .querySelector(`h3[data-testid="${type}-address"]`)
      ?.getBoundingClientRect()
    const top = window.scrollY + (tab?.top as number)
    const left = window.scrollX + (tab?.left as number)
    window.scrollTo({ left, top, behavior: "smooth" })
  }

  const handleShowBillingForm = () => {
    setBillingAddressFill(undefined)
    setShowBillingAddressForm(!showBillingAddressForm)
    handleScroll("billing")
  }

  const handleShowShippingForm = () => {
    setShippingAddressFill(undefined)
    setShowShippingAddressForm(!showShippingAddressForm)
    handleScroll("shipping")
  }

  const handleToggleBilling = () => {
    // Toggle means "use different billing address"
    const next = !billToDifferentAddress
    setShipToDifferentAddress(next)

    if (!hasCustomerAddresses) {
      // no address book: open/close billing form
      if (next) {
        setBillingAddressFill(undefined)
        setShowBillingAddressForm(true)
        setMountBillingAddressForm(true)
        handleScroll("billing")
      } else {
        setMountBillingAddressForm(false)
        setShowBillingAddressForm(false)
      }
    } else {
      // address book: just hide billing section when off
      if (!next) {
        setMountBillingAddressForm(false)
        setShowBillingAddressForm(false)
      }
    }
  }

  return (
    <Fragment>
      <AddressSectionEmail readonly emailAddress={emailAddress as string} />

      {/* Keep the CL container in place; we keep passing the boolean through.
          (Later you can rename this prop across the app.) */}
      <AddressesContainer shipToDifferentAddress={billToDifferentAddress}>
        {/* 1) SHIPPING FIRST */}
        {isShipmentRequired && (
          <>
            <AddressSectionTitle data-testid="shipping-address">
              <>{t("addressForm.shipping_address_title")}</>
            </AddressSectionTitle>

            <div className="relative">
              {hasCustomerAddresses && (
                <>
                  <Transition
                    show={!showShippingAddressForm}
                    as="div"
                    {...addressesTransition}
                  >
                    <GridContainer className="mb-4">
                      <ShippingAddressContainer>
                        <CustomerAddressCard
                          addressType="shipping"
                          deselect={showShippingAddressForm}
                          onSelect={() =>
                            localStorage.setItem(
                              "_save_shipping_address_to_customer_address_book",
                              "false",
                            )
                          }
                        />
                      </ShippingAddressContainer>
                    </GridContainer>
                  </Transition>

                  {!showShippingAddressForm && (
                    <AddButton
                      dataTestId="add_new_shipping_address"
                      action={handleShowShippingForm}
                    />
                  )}
                </>
              )}

              <div className="mt-4">
                <Transition
                  as="div"
                  show={showShippingAddressForm || !hasCustomerAddresses}
                  beforeEnter={() => setMountShippingAddressForm(true)}
                  beforeLeave={() => setMountShippingAddressForm(false)}
                  {...formTransition}
                >
                  <ShippingAddressForm
                    autoComplete="on"
                    reset={!mountShippingAddressForm}
                    errorClassName="hasError"
                    className="pt-2"
                  >
                    {mountShippingAddressForm || !hasCustomerAddresses ? (
                      <>
                        <ShippingAddressFormNew
                          shippingAddress={shippingAddressFill}
                        />
                        <AddressFormBottom
                          className="mb-4"
                          addressType="shipping"
                          onClick={handleShowShippingForm}
                          hasCustomerAddresses={hasCustomerAddresses}
                        />
                      </>
                    ) : (
                      <Fragment />
                    )}
                  </ShippingAddressForm>
                </Transition>
              </div>
            </div>
          </>
        )}

        {/* 2) TOGGLE: optional different BILLING */}
        <Toggle
          disabled={disabledShipToDifferentAddress}
          data-testid="button-bill-to-different-address"
          data-status={billToDifferentAddress}
          label={
            t("addressForm.use_different_billing_address") ||
            "Use a different billing address"
          }
          checked={billToDifferentAddress}
          onChange={handleToggleBilling}
        />

        {/* 3) BILLING only if toggled ON */}
        <div className={billToDifferentAddress ? "mt-2" : "hidden"}>
          <AddressSectionTitle data-testid="billing-address">
            <>{t("addressForm.billing_address_title")}</>
          </AddressSectionTitle>

          <div className="relative">
            {hasCustomerAddresses && (
              <>
                <Transition
                  as="div"
                  show={!showBillingAddressForm}
                  {...addressesTransition}
                >
                  <GridContainer className="mb-4">
                    <BillingAddressContainer>
                      <CustomerAddressCard
                        addressType="billing"
                        deselect={showBillingAddressForm}
                        onSelect={() => {
                          // Billing selection: do NOT run shipping lock logic here.
                          localStorage.setItem(
                            "_save_billing_address_to_customer_address_book",
                            "false",
                          )
                        }}
                      />
                    </BillingAddressContainer>
                  </GridContainer>
                </Transition>

                {!showBillingAddressForm && (
                  <AddButton
                    dataTestId="add_new_billing_address"
                    action={handleShowBillingForm}
                  />
                )}
              </>
            )}

            <div className="top-0 mt-4">
              <Transition
                as="div"
                show={showBillingAddressForm || !hasCustomerAddresses}
                beforeEnter={() => setMountBillingAddressForm(true)}
                afterLeave={() => setMountBillingAddressForm(false)}
                {...formTransition}
              >
                <BillingAddressForm
                  autoComplete="on"
                  reset={!showBillingAddressForm}
                  errorClassName="hasError"
                >
                  {mountBillingAddressForm || !hasCustomerAddresses ? (
                    <>
                      <BillingAddressFormNew
                        billingAddress={billingAddressFill}
                        openShippingAddress={openShippingAddress}
                      />
                      <AddressFormBottom
                        addressType="billing"
                        onClick={handleShowBillingForm}
                        hasCustomerAddresses={hasCustomerAddresses}
                      />
                    </>
                  ) : (
                    <Fragment />
                  )}
                </BillingAddressForm>
              </Transition>
            </div>
          </div>
        </div>

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

const addressesTransition = {
  enter: "transition duration-400 ease-in",
  enterFrom: "opacity-0  -translate-y-full",
  enterTo: "opacity-100 translate-y-0",
  leave: "duration-200 transition ease-out absolute top-0 w-full",
  leaveFrom: "opacity-100 translate-y-0 ",
  leaveTo: "opacity-0 -translate-y-full",
}

const formTransition = {
  enter: "transition duration-400 ease-in",
  enterFrom: "opacity-0 translate-y-full",
  enterTo: "opacity-100 translate-y-0",
  leave: "duration-400 transition ease-out absolute top-0 w-full",
  leaveFrom: "opacity-100 translate-y-0",
  leaveTo: "opacity-0 translate-y-full",
}
