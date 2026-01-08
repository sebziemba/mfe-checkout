import { Errors } from "@commercelayer/react-components/errors/Errors"
import { Trans, useTranslation } from "next-i18next"
import { type Dispatch, type SetStateAction, useEffect } from "react"

interface Props {
  messages: Parameters<typeof Errors>[0]["messages"]
  setOutOfStockError: Dispatch<SetStateAction<boolean>>
  cartUrl: NullableType<string>
}

export const OutOfStock = ({
  messages,
  setOutOfStockError,
  cartUrl,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Errors resource="line_items" messages={messages}>
      {({ errors }) => {
        return (
          <>
            <ErrorEffect
              errors={errors}
              setOutOfStockError={setOutOfStockError}
            />

            {errors.map((error, index) => (
              <p key={index}>
                {error}
                {cartUrl && (
                  <Trans
                    i18nKey={"stepShipping.outOfStockWithCart"}
                    values={{
                      link: t("stepShipping.outOfStockLink"),
                    }}
                    components={{
                      WrapperStyle: (
                        <strong className="text-black border-b font-normal border-gray-300 cursor-pointer" />
                      ),
                      Link: (
                        <a
                          data-testid="out-of-stock-cart-link font-medium"
                          href={`${cartUrl}`}
                        />
                      ),
                    }}
                  />
                )}
              </p>
            ))}
          </>
        )
      }}
    </Errors>
  )
}

const ErrorEffect = ({
  errors,
  setOutOfStockError,
}: {
  errors: any[]
  setOutOfStockError: Dispatch<SetStateAction<boolean>>
}) => {
  useEffect(() => {
    // DEBUG: this tells us exactly what the Errors component is giving you
    // (usually translated strings, not CL codes)
    // eslint-disable-next-line no-console
    console.log("[OutOfStock] Errors resource=line_items", { errors })

    const hasAnyError = Array.isArray(errors)
      ? errors.some((e) => typeof e === "string" && e.trim().length > 0)
      : false

    setOutOfStockError(hasAnyError)
  }, [errors, setOutOfStockError])

  return null
}
