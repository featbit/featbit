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
        href: "",
        icon: Rocket,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.release",
    items: [
      {
        labelKey: "layout.nav.items.featureFlags",
        href: "/feature-flags",
        icon: Flag,
      },
      {
        labelKey: "layout.nav.items.segments",
        href: "/segments",
        icon: Layers3,
      },
      {
        labelKey: "layout.nav.items.endUsers",
        href: "/end-users",
        icon: UsersRound,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.governance",
    items: [
      {
        labelKey: "layout.nav.items.auditLogs",
        href: "/audit-logs",
        icon: Logs,
      },
      {
        labelKey: "layout.nav.items.changeRequests",
        href: "/change-requests",
        icon: GitPullRequest,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.experimentation",
    items: [
      {
        labelKey: "layout.nav.items.experiments",
        href: "/experiments",
        icon: FlaskConical,
      },
      {
        labelKey: "layout.nav.items.metrics",
        href: "/metrics",
        icon: BarChart3,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.integrations",
    items: [
      {
        labelKey: "layout.nav.items.relayProxies",
        href: "/relay-proxies",
        icon: Waypoints,
      },
      {
        labelKey: "layout.nav.items.webhooks",
        href: "/webhooks",
        icon: Webhook,
      },
      {
        labelKey: "layout.nav.items.accessTokens",
        href: "/access-tokens",
        icon: KeyRound,
      },
    ],
  },
  {
    labelKey: "layout.nav.groups.admin",
    items: [
      {
        labelKey: "layout.nav.items.workspace",
        href: "/workspace",
        icon: Building2,
      },
      {
        labelKey: "layout.nav.items.organization",
        href: "/organization",
        icon: Boxes,
      },
      {
        labelKey: "layout.nav.items.iam",
        href: "/iam",
        icon: ShieldCheck,
        children: [
          {
            labelKey: "layout.nav.items.team",
            href: "/iam/team",
            icon: UserRound,
          },
          {
            labelKey: "layout.nav.items.groups",
            href: "/iam/groups",
            icon: UsersRound,
          },
          {
            labelKey: "layout.nav.items.policies",
            href: "/iam/policies",
            icon: UserRoundKey,
          },
        ],
      },
    ],
  },
]
