import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getRuntimeEnv } from "@/lib/env/runtime-env"
import { cn } from "@/lib/utils"
import type { GetStartedEnvironment } from "../get-started-types"
import { buildDemoUrl } from "../get-started-utils"

type ResourceLink = {
  label: string
  href: string
  disabledReason?: string
}

function ResourceRow({ resource }: { resource: ResourceLink }) {
  const commonClass =
    "flex min-h-8 items-center justify-between gap-3 rounded-md px-1 text-sm transition-colors"

  if (!resource.href) {
    return (
      <div className="rounded-md px-1 py-1">
        <div className="flex min-h-7 items-center justify-between gap-3 text-sm text-muted-foreground/60">
          <span>{resource.label}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </div>
        {resource.disabledReason ? (
          <p className="mt-0.5 pr-5 text-xs leading-4 text-muted-foreground">
            {resource.disabledReason}
          </p>
        ) : null}
      </div>
    )
  }

  const external = !resource.href.startsWith("mailto:")
  return (
    <a
      href={resource.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        commonClass,
        "text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
    >
      <span>{resource.label}</span>
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  )
}

export function ResourcesRail({
  environment,
}: {
  environment?: GetStartedEnvironment
}) {
  const { t } = useTranslation()
  const runtimeEnv = getRuntimeEnv()
  const clientSecret = environment?.secrets.find(
    (secret) => secret.type === "client"
  )?.value
  const demoUrl = buildDemoUrl(
    runtimeEnv.demoUrl,
    runtimeEnv.evaluationUrl,
    clientSecret ?? ""
  )
  const groups: Array<{ title: string; links: ResourceLink[] }> = [
    {
      title: t("getStarted.resources.groups.quickDemo"),
      links: [
        {
          label: t("getStarted.resources.links.createDemoFlags"),
          href: "https://docs.featbit.co/getting-started/create-two-feature-flags",
        },
        {
          label: t("getStarted.resources.links.interactiveDemo"),
          href: demoUrl,
          disabledReason: t("getStarted.resources.interactiveDemoUnavailable"),
        },
      ],
    },
    {
      title: t("getStarted.resources.groups.learn"),
      links: [
        {
          label: t("getStarted.resources.links.sdkDocumentation"),
          href: "https://docs.featbit.co/getting-started/connect-an-sdk",
        },
        {
          label: t("getStarted.resources.links.openApiDocumentation"),
          href: "https://docs.featbit.co/api-docs/overview",
        },
        {
          label: t("getStarted.resources.links.experimentationGuide"),
          href: "https://docs.featbit.co/experimentation/understanding-experimentation",
        },
      ],
    },
    {
      title: t("getStarted.resources.groups.deploy"),
      links: [
        {
          label: t("getStarted.resources.links.deployDockerCompose"),
          href: "https://docs.featbit.co/installation/docker-compose",
        },
      ],
    },
    {
      title: t("getStarted.resources.groups.team"),
      links: [
        {
          label: t("getStarted.resources.links.inviteTeam"),
          href: "https://docs.featbit.co/iam/teams",
        },
        {
          label: t("getStarted.resources.links.managePermissions"),
          href: "https://docs.featbit.co/iam/policies",
        },
      ],
    },
    {
      title: t("getStarted.resources.groups.community"),
      links: [
        {
          label: t("getStarted.resources.links.discord"),
          href: "https://discord.gg/h9dVMsQH",
        },
        {
          label: t("getStarted.resources.links.githubIssue"),
          href: "https://github.com/featbit/featbit",
        },
        {
          label: t("getStarted.resources.links.emailSupport"),
          href: "mailto:contact@featbit.com",
        },
      ],
    },
  ]

  return (
    <aside className="self-start rounded-lg border bg-card p-4 @min-[70rem]:sticky @min-[70rem]:top-5">
      <h2 className="text-base font-semibold">
        {t("getStarted.resources.title")}
      </h2>
      <div className="mt-3 grid gap-x-8 gap-y-5 @min-[48rem]:grid-cols-2 @min-[64rem]:grid-cols-3 @min-[70rem]:block @min-[70rem]:divide-y">
        {groups.map((group) => (
          <section
            key={group.title}
            className="@min-[70rem]:py-3 @min-[70rem]:first:pt-0 @min-[70rem]:last:pb-0"
          >
            <h3 className="mb-1.5 text-sm font-semibold">{group.title}</h3>
            <div className="space-y-0.5">
              {group.links.map((resource) => (
                <ResourceRow key={resource.label} resource={resource} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
