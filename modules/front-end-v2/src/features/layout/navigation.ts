import {
  BarChart3,
  Boxes,
  Building2,
  Flag,
  FlaskConical,
  GitPullRequest,
  KeyRound,
  Layers3,
  Logs,
  Rocket,
  ShieldCheck,
  UserRound,
  UserRoundKey,
  UsersRound,
  Waypoints,
  Webhook,
} from "lucide-react"
import type { NavGroup } from "@/features/layout/layout-types"

export const navigationGroups: NavGroup[] = [
  {
    labelKey: "layout.nav.groups.getStarted",
    items: [
      {
        labelKey: "layout.nav.items.getStarted",
        href: "/app",
        icon: Rocket,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.release",
    items: [
      {
        labelKey: "layout.nav.items.featureFlags",
        href: "/app/feature-flags",
        icon: Flag,
      },
      {
        labelKey: "layout.nav.items.segments",
        href: "/app/segments",
        icon: Layers3,
      },
      {
        labelKey: "layout.nav.items.endUsers",
        href: "/app/end-users",
        icon: UsersRound,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.experimentation",
    items: [
      {
        labelKey: "layout.nav.items.experiments",
        href: "/app/experiments",
        icon: FlaskConical,
      },
      {
        labelKey: "layout.nav.items.metrics",
        href: "/app/metrics",
        icon: BarChart3,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.governance",
    items: [
      {
        labelKey: "layout.nav.items.auditLogs",
        href: "/app/audit-logs",
        icon: Logs,
      },
      {
        labelKey: "layout.nav.items.changeRequests",
        href: "/app/change-requests",
        icon: GitPullRequest,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.integrations",
    items: [
      {
        labelKey: "layout.nav.items.relayProxies",
        href: "/app/relay-proxies",
        icon: Waypoints,
      },
      {
        labelKey: "layout.nav.items.webhooks",
        href: "/app/integrations/webhooks",
        icon: Webhook,
      },
      {
        labelKey: "layout.nav.items.accessTokens",
        href: "/app/integrations/access-tokens",
        icon: KeyRound,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.admin",
    items: [
      {
        labelKey: "layout.nav.items.workspace",
        href: "/app/workspace",
        icon: Building2,
      },
      {
        labelKey: "layout.nav.items.organization",
        href: "/app/organization",
        icon: Boxes,
      },
      {
        labelKey: "layout.nav.items.iam",
        href: "/app/iam",
        icon: ShieldCheck,
        children: [
          {
            labelKey: "layout.nav.items.team",
            href: "/app/iam/team",
            icon: UserRound,
          },
          {
            labelKey: "layout.nav.items.groups",
            href: "/app/iam/groups",
            icon: UsersRound,
          },
          {
            labelKey: "layout.nav.items.policies",
            href: "/app/iam/policies",
            icon: UserRoundKey,
          },
        ],
      },
    ],
  },
]
