import i18n from "i18next"
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
  nl: { translation: translationNL },
  it: { translation: translationIT },
  de: { translation: translationDE },
  pl: { translation: translationPL },
  es: { translation: translationES },
  fr: { translation: translationFR },
  hr: { translation: translationHR },
  hu: { translation: translationHU },
  pt: { translation: translationPT },
  sl: { translation: translationSL },
}

const FORCE_LNG = "nl"

export function initI18n() {
  // If someone else initialized i18next, we still force Dutch.
  if (i18n.isInitialized) {
    if (i18n.language !== FORCE_LNG) {
      void i18n.changeLanguage(FORCE_LNG)
    }
    return
  }

  i18n.use(initReactI18next).init({
    resources,
    lng: FORCE_LNG,
    fallbackLng: FORCE_LNG,

    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
}

export default i18n
