import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { enAuth, zhAuth } from "./resources/auth"
import { enLayout, zhLayout } from "./resources/layout"
import { enOnboarding, zhOnboarding } from "./resources/onboarding"
import { enOrganization, zhOrganization } from "./resources/organization"
import { enProfile, zhProfile } from "./resources/profile"
import {
  enWorkspaceSelection,
  zhWorkspaceSelection,
} from "./resources/workspace-selection"
import { enWorkspace, zhWorkspace } from "./resources/workspace"

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: {
        auth: enAuth,
        selectWorkspace: enWorkspaceSelection,
        onboarding: enOnboarding,
        layout: enLayout,
        organization: enOrganization,
        profile: enProfile,
        workspace: enWorkspace,
      },
    },
    zh: {
      common: {
        auth: zhAuth,
        selectWorkspace: zhWorkspaceSelection,
        onboarding: zhOnboarding,
        layout: zhLayout,
        organization: zhOrganization,
        profile: zhProfile,
        workspace: zhWorkspace,
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
