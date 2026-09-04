import { useMutation, useQuery } from "@tanstack/react-query"
import { Plus, Search, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
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
import {
  getCurrentProjectEnv,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { ExperimentSheet } from "./components/experiment-sheet"
import { FlagKeyFilter } from "./components/flag-key-filter"
import { ExperimentsPagination } from "./components/experiments-pagination"
import { ExperimentsTable } from "./components/experiments-table"
import type { ExperimentStage } from "./experiment-types"
import { createExperiment, fetchExperiments } from "./experiments-api"

const STAGES: ExperimentStage[] = [
  "hypothesis",
  "implementing",
  "measuring",
  "learning",
]

function positiveInt(
  value: string | null,
  fallback: number,
  allowed?: number[]
) {
  const parsed = Number(value)
  return Number.isInteger(parsed) &&
    parsed >= 1 &&
    (!allowed || allowed.includes(parsed))
    ? parsed
    : fallback
}

function stageFromParam(value: string | null): ExperimentStage | "all" {
  return STAGES.includes(value as ExperimentStage)
    ? (value as ExperimentStage)
    : "all"
}

export function ExperimentsPage() {
  const { t } = useTranslation()
  const { lang: langParam } = useParams()
  const lang = resolveLang(langParam)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const projectEnv = getCurrentProjectEnv()
  const envId = projectEnv?.envId ?? ""
  const [name, setName] = useState(() => searchParams.get("name") ?? "")
  const [debouncedName, setDebouncedName] = useState(name.trim())
  const [sheetOpen, setSheetOpen] = useState(false)
  const flagKey = searchParams.get("flagKey") ?? ""
  const stage = stageFromParam(searchParams.get("stage"))
  const pageIndex = positiveInt(searchParams.get("page"), 1)
  const pageSize = positiveInt(searchParams.get("pageSize"), 10, [10, 20, 30])

  const updateParams = useCallback(
    (updates: Record<string, string | null>, resetPage = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(updates)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          if (resetPage) next.delete("page")
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    if (name.trim() === debouncedName) return

    const timeout = window.setTimeout(() => {
      const value = name.trim()
      setDebouncedName(value)
      updateParams({ name: value || null }, true)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [name, debouncedName, updateParams])

  const listQuery = useQuery({
    queryKey: [
      "experiments",
      envId,
      debouncedName,
      flagKey,
      stage,
      pageIndex,
      pageSize,
    ],
    queryFn: () =>
      fetchExperiments(envId, {
        name: debouncedName,
        flagKey,
        stage,
        pageIndex: pageIndex - 1,
        pageSize,
      }),
    enabled: Boolean(envId),
    placeholderData: (previous) => previous,
  })

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createExperiment>[1]) =>
      createExperiment(envId, payload),
    onSuccess: (experiment) => {
      setSheetOpen(false)
      toast.success(t("releaseDecision.experiments.createSucceeded"))
      navigate(
        localizedPath(lang, `/experiments/${encodeURIComponent(experiment.id)}`)
      )
    },
  })

  const filtered = Boolean(debouncedName || flagKey || stage !== "all")
  const data = listQuery.data ?? { items: [], totalCount: 0 }

  function clearFilters() {
    setName("")
    setDebouncedName("")
    updateParams({ name: null, flagKey: null, stage: null }, true)
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-6 py-6 lg:px-8">
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {t("releaseDecision.experiments.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("releaseDecision.experiments.subtitle")}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={name}
              className="pl-9"
              placeholder={t("releaseDecision.experiments.nameFilter")}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <FlagKeyFilter
            envId={envId}
            value={flagKey}
            onChange={(key) => updateParams({ flagKey: key || null }, true)}
          />
          <Select
            value={stage}
            onValueChange={(value) =>
              updateParams({ stage: value === "all" ? null : value }, true)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {t(
                  stage === "all"
                    ? "releaseDecision.experiments.allStages"
                    : `releaseDecision.experiments.stages.${stage}`
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {t("releaseDecision.experiments.allStages")}
                </SelectItem>
                {STAGES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {t(`releaseDecision.experiments.stages.${item}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {filtered ? (
            <Button type="button" variant="outline" onClick={clearFilters}>
              <X />
              {t("releaseDecision.experiments.clearFilters")}
            </Button>
          ) : null}
        </div>

        <Button type="button" onClick={() => setSheetOpen(true)}>
          <Plus />
          {t("releaseDecision.experiments.new")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-background">
        {!envId || listQuery.isError ? (
          <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
            <span>{t("releaseDecision.experiments.loadFailed")}</span>
            {envId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
              >
                {t("releaseDecision.experiments.retry")}
              </Button>
            ) : null}
          </div>
        ) : null}
        <ExperimentsTable
          items={data.items}
          loading={listQuery.isLoading}
          filtered={filtered}
          lang={lang}
          detailsHref={(id) =>
            localizedPath(lang, `/experiments/${encodeURIComponent(id)}`)
          }
          onFlagFilter={(key) => {
            updateParams({ flagKey: key }, true)
          }}
          onClearFilters={clearFilters}
          onCreate={() => setSheetOpen(true)}
        />
      </div>

      <ExperimentsPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={data.totalCount}
        disabled={listQuery.isFetching}
        onPageIndexChange={(page) =>
          updateParams({ page: page === 1 ? null : String(page) })
        }
        onPageSizeChange={(size) =>
          updateParams({ pageSize: String(size) }, true)
        }
      />

      {sheetOpen ? (
        <ExperimentSheet
          projectEnv={projectEnv}
          saving={createMutation.isPending}
          saveError={createMutation.isError}
          onOpenChange={(open) => {
            if (!open) {
              setSheetOpen(false)
              createMutation.reset()
            }
          }}
          onSubmit={(payload) =>
            createMutation.mutateAsync(payload).then(() => undefined)
          }
        />
      ) : null}
    </div>
  )
}
