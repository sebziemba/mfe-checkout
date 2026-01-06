import { ErrorContainer } from "components/composite/ErrorContainer"
import { ErrorCode, Text } from "components/composite/ErrorContainer/styled"
import type { NextPage } from "next"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const DEBUG_KEY = "cl_checkout_debug"

const Invalid: NextPage<{ errorCode?: 404 | 419; message?: string }> = ({
  errorCode = 404,
  message = "general.invalid",
}) => {
  const { t } = useTranslation()
  const [debug, setDebug] = useState<any[]>([])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DEBUG_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      setDebug(Array.isArray(parsed) ? parsed : [])
    } catch {
      setDebug([])
    }
  }, [])

  return (
    <ErrorContainer>
      <ErrorCode>{errorCode}</ErrorCode>
      <Text data-testid="invalid-checkout">
        {message === "general.invalid" ? t(message) : message}
      </Text>

      {/* Debug output (temporary) */}
      <div style={{ width: "100%", maxWidth: 960, marginTop: 24 }}>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            textAlign: "left",
            padding: 12,
            borderRadius: 8,
            background: "rgba(0,0,0,0.04)",
            overflowX: "auto",
          }}
        >
          {debug.length
            ? JSON.stringify(debug, null, 2)
            : "No debug trace found in sessionStorage."}
        </pre>
      </div>
    </ErrorContainer>
  )
}

export default Invalid
