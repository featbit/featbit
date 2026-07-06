import i18n from "i18next"
import { initReactI18next } from "react-i18next"

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: {
        shell: {
          eyebrow: "FeatBit React migration",
          login: {
            title: "Login route ready",
            description:
              "The app foundation is wired. The redesigned login page will migrate in the next step.",
          },
          sso: {
            title: "SSO route ready",
            description:
              "The localized SSO entry point is available without migrating the old UI.",
          },
          app: {
            title: "Application shell ready",
            description:
              "Routing, providers, theme, runtime env, and i18n are now available in front-end-v2.",
          },
          version: "Version: {{version}}",
        },
      },
    },
    zh: {
      common: {
        shell: {
          eyebrow: "FeatBit React migration",
          login: {
            title: "Login route ready",
            description:
              "The app foundation is wired. The redesigned login page will migrate in the next step.",
          },
          sso: {
            title: "SSO route ready",
            description:
              "The localized SSO entry point is available without migrating the old UI.",
          },
          app: {
            title: "Application shell ready",
            description:
              "Routing, providers, theme, runtime env, and i18n are now available in front-end-v2.",
          },
          version: "Version: {{version}}",
        },
      },
    },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
})

export { i18n }
