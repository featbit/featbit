import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { enAccessTokens, zhAccessTokens } from "./resources/access-tokens"
import { enAuditLogs, zhAuditLogs } from "./resources/audit-logs"
import { enAuth, zhAuth } from "./resources/auth"
import { enChangeRequests, zhChangeRequests } from "./resources/change-requests"
import { enEndUsers, zhEndUsers } from "./resources/end-users"
import {
  enReleaseDecision,
  zhReleaseDecision,
} from "./resources/release-decision"
import { enReleaseHealth, zhReleaseHealth } from "./resources/release-health"
import { enFeatureFlags, zhFeatureFlags } from "./resources/feature-flags"
import { enGetStarted, zhGetStarted } from "./resources/get-started"
import { enLayout, zhLayout } from "./resources/layout"
import { enIam, zhIam } from "./resources/iam"
import { enOnboarding, zhOnboarding } from "./resources/onboarding"
import { enOrganization, zhOrganization } from "./resources/organization"
import { enProfile, zhProfile } from "./resources/profile"
import { enRelayProxies, zhRelayProxies } from "./resources/relay-proxies"
import { enSegments, zhSegments } from "./resources/segments"
import { enTargeting, zhTargeting } from "./resources/targeting"
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
        changeRequests: enChangeRequests,
        endUsers: enEndUsers,
        releaseDecision: enReleaseDecision,
        releaseHealth: enReleaseHealth,
        featureFlags: enFeatureFlags,
        getStarted: enGetStarted,
        segments: enSegments,
        targeting: enTargeting,
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
        changeRequests: zhChangeRequests,
        endUsers: zhEndUsers,
        releaseDecision: zhReleaseDecision,
        releaseHealth: zhReleaseHealth,
        featureFlags: zhFeatureFlags,
        getStarted: zhGetStarted,
        segments: zhSegments,
        targeting: zhTargeting,
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
