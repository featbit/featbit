import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCheck,
  Plus,
  Search,
  Webhook,
} from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import {
  fetchWebhookEnvironmentResources,
  fetchWebhookProjects,
} from "../webhooks-api"
import { PayloadPreviewDialog } from "./payload-preview-dialog"
import {
  previewStoreKey,
  removePreviewWebhook,
  savePreviewWebhook,
  useReleaseHealthWebhooks,
  type ReleaseHealthWebhook,
} from "./preview-store"
import { ReleaseHealthWebhookSheet } from "./release-health-webhook-sheet"
import { ReleaseHealthWebhooksTable } from "./release-health-webhooks-table"

export function ReleaseHealthWebhooksContent() {
  const { t } = useTranslation()
  const h = (key: string) => t(`webhooks.releaseHealth.${key}`)
  const owner = previewStoreKey()
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState<{
    webhook: ReleaseHealthWebhook | null
  } | null>(() => (params.get("create") === "1" ? { webhook: null } : null))
  const [search, setSearch] = useState("")
  const [projectId, setProjectId] = useState("all")
  const [environmentId, setEnvironmentId] = useState("all")
  const [preview, setPreview] = useState<ReleaseHealthWebhook | null>(null)
  const [remove, setRemove] = useState<ReleaseHealthWebhook | null>(null)
  useEffect(() => {
    if (params.get("create") !== "1") return
    const next = new URLSearchParams(params)
    next.delete("create")
    setParams(next, { replace: true })
  }, [params, setParams])
  const catalogue = useReleaseHealthWebhooks()
  const projects = useQuery({
    queryKey: ["webhook-projects", owner],
    queryFn: fetchWebhookProjects,
    enabled: Boolean(owner),
    staleTime: 60_000,
  })
  const environments = useQuery({
    queryKey: ["webhook-environments", owner],
    queryFn: fetchWebhookEnvironmentResources,
    enabled: Boolean(sheet && owner),
    staleTime: 60_000,
  })
  const selectedProject = projects.data?.find(
    (project) => project.id === projectId
  )
  const items = useMemo(
    () =>
      (catalogue.data ?? []).filter(
        (item) =>
          item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (projectId === "all" ||
            item.scopes.some((scope) => {
              const [project, environmentIds = ""] = scope.split("/")
              return (
                project === projectId &&
                (environmentId === "all" ||
                  environmentIds.split(",").includes(environmentId))
              )
            }))
      ),
    [catalogue.data, search, projectId, environmentId]
  )
  const filtered = Boolean(search || projectId !== "all")
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-lg border p-5">
        <div className="max-w-2xl space-y-2">
          <h2 className="flex items-center gap-2 font-medium">
            <Activity className="size-4" />
            {h("title")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {h("description")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">
            <BellRing className="size-3 text-amber-600" />
            {h("triggered")}
          </Badge>
          <ArrowRight className="size-3 text-muted-foreground" />
          <Badge variant="outline">
            <CheckCheck className="size-3 text-emerald-600" />
            {h("recovered")}
          </Badge>
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{h("previewBadge")}</Badge>
        {h("previewNotice")}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("webhooks.search")}
              aria-label={t("webhooks.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={projectId}
            onValueChange={(value) => {
              if (!value) return
              setProjectId(value)
              setEnvironmentId("all")
            }}
            disabled={projects.isPending || projects.isError}
          >
            <SelectTrigger className="w-56" aria-label={t("webhooks.project")}>
              <SelectValue>
                {selectedProject?.name ?? t("webhooks.allProjects")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{t("webhooks.allProjects")}</SelectItem>
                {(projects.data ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={environmentId}
            onValueChange={(value) => value && setEnvironmentId(value)}
            disabled={
              !selectedProject || projects.isPending || projects.isError
            }
          >
            <SelectTrigger
              className="w-48"
              aria-label={h("environment")}
              title={!selectedProject ? h("selectProjectFirst") : undefined}
            >
              <SelectValue>
                {selectedProject?.environments.find(
                  (environment) => environment.id === environmentId
                )?.name ?? h("allEnvironments")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{h("allEnvironments")}</SelectItem>
                {(selectedProject?.environments ?? []).map((environment) => (
                  <SelectItem key={environment.id} value={environment.id}>
                    {environment.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setSheet({ webhook: null })}
          disabled={!owner || catalogue.isError}
        >
          <Plus />
          {h("new")}
        </Button>
      </div>
      {projects.isError && (
        <Button variant="outline" onClick={() => void projects.refetch()}>
          {t("webhooks.projectLoadFailed")} {t("webhooks.retry")}
        </Button>
      )}
      {catalogue.isError ? (
        <div role="alert" className="rounded-lg border p-8 text-center">
          <p>{t("webhooks.loadFailed")}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void catalogue.refetch()}
          >
            {t("webhooks.retry")}
          </Button>
        </div>
      ) : catalogue.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length ? (
        <ReleaseHealthWebhooksTable
          key={`${search}-${projectId}-${environmentId}`}
          items={items}
          onEdit={(webhook) => setSheet({ webhook })}
          onPreview={setPreview}
          onRemove={setRemove}
        />
      ) : (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <Webhook className="mx-auto mb-4 size-7 text-muted-foreground" />
          <p className="font-medium">
            {filtered ? t("webhooks.filteredEmpty") : h("empty")}
          </p>
          {!filtered && (
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {h("emptyHelp")}
            </p>
          )}
          <Button
            variant="outline"
            className="mt-5"
            onClick={() =>
              filtered
                ? (setSearch(""), setProjectId("all"), setEnvironmentId("all"))
                : setSheet({ webhook: null })
            }
          >
            {filtered ? t("webhooks.clearFilters") : h("new")}
          </Button>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {h("usageNotice")}
      </p>
      {sheet && (
        <ReleaseHealthWebhookSheet
          webhook={sheet.webhook}
          initialEnvId={getCurrentProjectEnv()?.envId}
          projects={projects.data ?? []}
          environments={environments.data ?? []}
          loading={projects.isPending || environments.isPending}
          loadError={projects.isError || environments.isError}
          onRetry={() => {
            void projects.refetch()
            void environments.refetch()
          }}
          onClose={() => setSheet(null)}
          onSave={async (draft) => {
            if (!owner || owner !== previewStoreKey())
              throw new Error("missing-context")
            // Recheck accessible scope data before persisting the shared destination.
            const [freshProjects, freshEnvironments] = await Promise.all([
              projects.refetch(),
              environments.refetch(),
            ])
            if (owner !== previewStoreKey()) throw new Error("missing-context")
            if (freshProjects.isError || freshEnvironments.isError)
              throw new Error("scope-unavailable")
            const allowed = new Set(
              freshEnvironments.data?.map((env) => env.id)
            )
            if (
              draft.scopes.some((scope) => {
                const [pid, ids] = scope.split("/")
                const project = freshProjects.data?.find(
                  (item) => item.id === pid
                )
                return (
                  !project ||
                  ids
                    .split(",")
                    .some(
                      (id) =>
                        !allowed.has(id) ||
                        !project.environments.some((env) => env.id === id)
                    )
                )
              })
            )
              throw new Error("scope-unavailable")
            savePreviewWebhook(owner, draft, sheet.webhook?.id)
            setSheet(null)
            toast.success(h("saved"))
          }}
        />
      )}
      {preview && (
        <PayloadPreviewDialog
          template={preview.payloadTemplate}
          onClose={() => setPreview(null)}
        />
      )}
      <AlertDialog
        open={Boolean(remove)}
        onOpenChange={(open) => !open && setRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("webhooks.remove.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("webhooks.releaseHealth.removeHelp", {
                name: remove?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>
              {t("webhooks.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  if (!owner || !remove || owner !== previewStoreKey())
                    throw new Error("missing-context")
                  removePreviewWebhook(owner, remove.id)
                  setRemove(null)
                  toast.success(t("webhooks.removed"))
                } catch {
                  toast.error(t("webhooks.removeFailed"))
                }
              }}
            >
              {t("webhooks.remove.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
