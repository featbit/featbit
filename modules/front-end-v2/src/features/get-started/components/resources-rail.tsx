import { ExternalLink } from "lucide-react"
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
    "flex min-h-9 items-center justify-between gap-3 rounded-md px-1 text-sm transition-colors"

  if (!resource.href) {
    return (
      <span
        className={cn(
          commonClass,
          "cursor-not-allowed text-muted-foreground/60"
        )}
        title={resource.disabledReason}
      >
        <span>{resource.label}</span>
        <ExternalLink className="size-3.5 shrink-0" />
      </span>
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
      title: "Quick demo",
      links: [
        {
          label: "Create flags for the demo",
          href: "https://docs.featbit.co/getting-started/create-two-feature-flags",
        },
        {
          label: "Try the interactive demo",
          href: demoUrl,
          disabledReason:
            "A client secret and evaluation URL are required for the interactive demo.",
        },
      ],
    },
    {
      title: "Learn",
      links: [
        {
          label: "SDK documentation",
          href: "https://docs.featbit.co/getting-started/connect-an-sdk",
        },
        {
          label: "Open API documentation",
          href: "https://docs.featbit.co/api-docs/overview",
        },
        {
          label: "Experimentation guide",
          href: "https://docs.featbit.co/experimentation/understanding-experimentation",
        },
      ],
    },
    {
      title: "Deploy",
      links: [
        {
          label: "Deploy with Docker Compose",
          href: "https://docs.featbit.co/installation/docker-compose",
        },
      ],
    },
    {
      title: "Team",
      links: [
        {
          label: "Invite team members",
          href: "https://docs.featbit.co/iam/teams",
        },
        {
          label: "Manage custom permissions",
          href: "https://docs.featbit.co/iam/policies",
        },
      ],
    },
    {
      title: "Community & support",
      links: [
        { label: "Discord community", href: "https://discord.gg/h9dVMsQH" },
        {
          label: "Open an issue on GitHub",
          href: "https://github.com/featbit/featbit",
        },
        { label: "Email support", href: "mailto:contact@featbit.com" },
      ],
    },
  ]

  return (
    <aside className="self-start rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">Resources</h2>
      <div className="mt-4 divide-y">
        {groups.map((group) => (
          <section key={group.title} className="py-4 first:pt-0 last:pb-0">
            <h3 className="mb-2 text-sm font-semibold">{group.title}</h3>
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
