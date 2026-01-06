import { ErrorContainer } from "components/composite/ErrorContainer"
import { ErrorCode, Text } from "components/composite/ErrorContainer/styled"
import type { NextPage } from "next"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { readDebug } from "utils/debugTrace"

const Invalid: NextPage<{ errorCode?: 404 | 419; message?: string }> = ({
  errorCode = 404,
  message = "general.invalid",
}) => {
  const { t } = useTranslation()

  const debug = useMemo(() => {
    try {
      const arr = readDebug()
      return arr.length ? JSON.stringify(arr, null, 2) : null
    } catch {
      return null
    }
  }, [])

  const copy = async () => {
    if (!debug) return
    try {
      await navigator.clipboard.writeText(debug)
      // use alert because console logs seem to be suppressed for you
      alert("Debug trace copied to clipboard.")
    } catch {
      alert("Could not copy. Select the text and copy manually.")
    }
  }

  return (
    <ErrorContainer>
      <ErrorCode>{errorCode}</ErrorCode>
      <Text data-testid="invalid-checkout">
        {message === "general.invalid" ? t(message) : message}
      </Text>

      <div style={{ marginTop: 16, maxWidth: 900, width: "100%" }}>
        {!debug ? (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "rgba(0,0,0,0.06)",
              fontSize: 13,
            }}
          >
            No debug trace found in storage (session/local).
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={copy}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Copy debug
              </button>
            </div>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                lineHeight: 1.35,
                padding: 12,
                borderRadius: 8,
                background: "rgba(0,0,0,0.06)",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              {debug}
            </pre>
          </>
        )}
      </div>
    </ErrorContainer>
  )
}

export default Invalid
