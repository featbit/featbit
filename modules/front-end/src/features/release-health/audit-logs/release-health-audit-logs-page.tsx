import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
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
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { AuditLogDetails } from "./audit-log-details"
import { AuditLogTable } from "./audit-log-table"
import {
  auditModules,
  createAuditLogSamples,
  type ReleaseHealthAuditLog,
} from "./audit-log-samples"

export function ReleaseHealthAuditLogsPage() {
  const context = getCurrentProjectEnv()
  // Environment switches reset filters, pagination and the open record together.
  return (
    <AuditLogsView
      key={`${context?.projectId}:${context?.envId}`}
      project={context?.projectName ?? "Project"}
      environment={context?.envName ?? "Environment"}
    />
  )
}

function AuditLogsView({
  project,
  environment,
}: {
  project: string
  environment: string
}) {
  const { t } = useTranslation()
  const a = (key: string) => t(`releaseHealth.audit.${key}`)
  const [records] = useState(() => createAuditLogSamples(Date.now()))
  const [search, setSearch] = useState("")
  const [module, setModule] = useState("all")
  const [source, setSource] = useState("all")
  const [result, setResult] = useState("all")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ReleaseHealthAuditLog | null>(null)
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return records.filter(
      (record) =>
        (module === "all" || record.module === module) &&
        (source === "all" || record.source === source) &&
        (result === "all" || record.result === result) &&
        `${record.object.name} ${record.object.key} ${record.actor.name} ${record.id}`
          .toLocaleLowerCase()
          .includes(query)
    )
  }, [records, search, module, source, result])
  const hasFilters =
    search !== "" || module !== "all" || source !== "all" || result !== "all"
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setPage(0)
  }
  function clearFilters() {
    setSearch("")
    setModule("all")
    setSource("all")
    setResult("all")
    setPage(0)
  }

  return (
    <ReleaseHealthShell activeTab="auditLogs" notice={a("demoNotice")}>
      <section
        className="min-w-0 space-y-4"
        aria-labelledby="release-health-audit-heading"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="release-health-audit-heading"
              className="text-lg font-medium"
            >
              {a("title")}
            </h2>
            <Badge variant="secondary">
              {t("releaseHealth.audit.count", { count: records.length })}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {a("description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              aria-label={a("search")}
              placeholder={a("search")}
              value={search}
              onChange={(event) => filter(setSearch)(event.target.value)}
            />
          </div>
          <AuditFilter
            label={a("module")}
            value={module}
            onChange={filter(setModule)}
            options={[
              ["all", a("allModules")],
              ...auditModules.map(
                (kind) => [kind, a(`modules.${kind}`)] as [string, string]
              ),
            ]}
          />
          <AuditFilter
            label={a("source")}
            value={source}
            onChange={filter(setSource)}
            options={[
              ["all", a("allSources")],
              ["UI", "UI"],
              ["API", "API"],
            ]}
          />
          <AuditFilter
            label={a("result")}
            value={result}
            onChange={filter(setResult)}
            options={[
              ["all", a("allResults")],
              ["succeeded", a("succeeded")],
              ["failed", a("failed")],
            ]}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {a("clear")}
            </Button>
          )}
        </div>
        <AuditLogTable
          data={filtered}
          environment={environment}
          pageIndex={page}
          onPageChange={setPage}
          onSelect={setSelected}
        />
        <p className="text-xs text-muted-foreground">
          {t("releaseHealth.audit.timezone", {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
        </p>
      </section>
      <AuditLogDetails
        record={selected}
        project={project}
        environment={environment}
        onClose={() => setSelected(null)}
      />
    </ReleaseHealthShell>
  )
}

function AuditFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger className="w-40" aria-label={label}>
        <SelectValue>{options.find(([key]) => key === value)?.[1]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
