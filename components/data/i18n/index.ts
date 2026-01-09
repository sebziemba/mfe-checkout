import i18n, { use } from "i18next"
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

const languages = ["nl"]

const resources = {
  nl: {
    translation: translationNL,
  },
}

use(initReactI18next).init({
  resources,
  lng: languages[0],
  fallbackLng: languages,
})

export default i18n
