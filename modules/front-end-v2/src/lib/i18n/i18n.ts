import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { enAccessTokens, zhAccessTokens } from "./resources/access-tokens"
import { enAuditLogs, zhAuditLogs } from "./resources/audit-logs"
import { enAuth, zhAuth } from "./resources/auth"
import { enEndUsers, zhEndUsers } from "./resources/end-users"
import { enLayout, zhLayout } from "./resources/layout"
import { enIam, zhIam } from "./resources/iam"
import { enOnboarding, zhOnboarding } from "./resources/onboarding"
import { enOrganization, zhOrganization } from "./resources/organization"
import { enProfile, zhProfile } from "./resources/profile"
import { enRelayProxies, zhRelayProxies } from "./resources/relay-proxies"
import { enSegments, zhSegments } from "./resources/segments"
import { enWebhooks, zhWebhooks } from "./resources/webhooks"
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
        iam: enIam,
        organization: enOrganization,
        profile: enProfile,
        workspace: enWorkspace,
        webhooks: enWebhooks,
        relayProxies: enRelayProxies,
        accessTokens: enAccessTokens,
        auditLogs: enAuditLogs,
        endUsers: enEndUsers,
        segments: enSegments,
      },
    },
    zh: {
      common: {
        auth: zhAuth,
        selectWorkspace: zhWorkspaceSelection,
        onboarding: zhOnboarding,
        layout: zhLayout,
        iam: zhIam,
        organization: zhOrganization,
        profile: zhProfile,
        workspace: zhWorkspace,
        webhooks: zhWebhooks,
        relayProxies: zhRelayProxies,
        accessTokens: zhAccessTokens,
        auditLogs: zhAuditLogs,
        endUsers: zhEndUsers,
        segments: zhSegments,
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
