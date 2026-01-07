import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import translationDE from "public/static/locales/de/common.json"
import translationEN from "public/static/locales/en/common.json"
import translationES from "public/static/locales/es/common.json"
import translationFR from "public/static/locales/fr/common.json"
import translationHR from "public/static/locales/hr/common.json"
import translationHU from "public/static/locales/hu/common.json"
import translationIT from "public/static/locales/it/common.json"
import translationNL from "public/static/locales/nl/common.json"
import translationPL from "public/static/locales/pl/common.json"
import translationPT from "public/static/locales/pt/common.json"
import translationSL from "public/static/locales/sl/common.json"
import { initReactI18next } from "react-i18next"

const resources = {
  en: { translation: translationEN },
  it: { translation: translationIT },
  de: { translation: translationDE },
  pl: { translation: translationPL },
  es: { translation: translationES },
  fr: { translation: translationFR },
  hr: { translation: translationHR },
  hu: { translation: translationHU },
  pt: { translation: translationPT },
  sl: { translation: translationSL },
  nl: { translation: translationNL },
} as const

const supportedLngs = [
  "en",
  "it",
  "de",
  "pl",
  "es",
  "fr",
  "hr",
  "hu",
  "pt",
  "sl",
  "nl",
] as const

const isBrowser = typeof window !== "undefined"

if (!i18n.isInitialized) {
  // ⚠️ IMPORTANT:
  // Only attach the language detector in the browser.
  // If it runs on the server, it will lock the language to fallback.
  if (isBrowser) {
    i18n.use(LanguageDetector)
  }

  i18n.use(initReactI18next).init({
    resources,
    supportedLngs: [...supportedLngs],

    // ✅ Fallback should be a single language
    fallbackLng: "nl",

    // ✅ Makes nl-NL → nl
    load: "languageOnly",
    nonExplicitSupportedLngs: true,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      // navigator first → real browser language
      order: ["navigator", "htmlTag", "localStorage", "cookie"],
      caches: ["localStorage", "cookie"],
    },

    react: {
      useSuspense: false,
    },
  })
}

export default i18n
