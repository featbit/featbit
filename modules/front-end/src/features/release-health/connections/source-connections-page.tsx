import {
  CheckCircle2,
  CircleOff,
  CloudCog,
  Pencil,
  Play,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { SourceConnectionSheet } from "../components/source-connection-sheet"
import { metricSourceConnections } from "../release-health-mock-data"
import type {
  MetricSourceConnection,
  MetricSourceConnectionStatus,
} from "../release-health-types"

export function SourceConnectionsPage() {
  const { t } = useTranslation()
  const context = getCurrentProjectEnv()
  const environmentKey = context?.envKey ?? "production"
  const environmentName = context?.envName ?? "Production"
  const [connections, setConnections] = useState<MetricSourceConnection[]>(() =>
    metricSourceConnections.map((connection) => ({
      ...connection,
      environmentKey,
    }))
  )
  const [search, setSearch] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<MetricSourceConnection>()

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return connections
    return connections.filter((connection) =>
      `${connection.name} ${connection.endpoint} ${connection.providerType}`
        .toLowerCase()
        .includes(query)
    )
  }, [connections, search])

  const connectedCount = connections.filter(
    (connection) => connection.status === "connected"
  ).length
  const bindingCount = connections.reduce(
    (total, connection) => total + connection.usedByBindings,
    0
  )

  function openCreate() {
    setEditing(undefined)
    setEditorOpen(true)
  }

  function openEdit(connection: MetricSourceConnection) {
    setEditing(connection)
    setEditorOpen(true)
  }

  function saveConnection(connection: MetricSourceConnection) {
    setConnections((current) => {
      const existing = current.some((item) => item.id === connection.id)
      return existing
        ? current.map((item) => (item.id === connection.id ? connection : item))
        : [...current, connection]
    })
  }

  function testConnection(connection: MetricSourceConnection) {
    setConnections((current) =>
      current.map((item) =>
        item.id === connection.id
          ? {
              ...item,
              status: "connected",
              lastCheckedAt: t("releaseHealth.connections.justNow"),
            }
          : item
      )
    )
    toast.success(
      t("releaseHealth.connections.testPassed", { name: connection.name })
    )
  }

  return (
    <ReleaseHealthShell activeTab="connections">
      <div className="space-y-4">
        <Alert>
          <CloudCog />
          <AlertDescription>
            {t("releaseHealth.connections.scopeNotice", {
              project: context?.projectName ?? "Project",
              environment: environmentName,
            })}
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label={t("releaseHealth.connections.summary.total")}
            value={String(connections.length)}
          />
          <SummaryCard
            label={t("releaseHealth.connections.summary.connected")}
            value={`${connectedCount} / ${connections.length}`}
          />
          <SummaryCard
            label={t("releaseHealth.connections.summary.bindings")}
            value={String(bindingCount)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="pl-9"
              placeholder={t("releaseHealth.connections.search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button onClick={openCreate}>
            <Plus />
            {t("releaseHealth.connections.add")}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">
                  {t("releaseHealth.connections.connection")}
                </TableHead>
                <TableHead>{t("releaseHealth.connections.provider")}</TableHead>
                <TableHead>{t("releaseHealth.connections.endpoint")}</TableHead>
                <TableHead>{t("releaseHealth.connections.status")}</TableHead>
                <TableHead>{t("releaseHealth.connections.usedBy")}</TableHead>
                <TableHead>
                  {t("releaseHealth.connections.lastChecked")}
                </TableHead>
                <TableHead className="pr-4 text-right">
                  {t("releaseHealth.connections.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((connection) => (
                <TableRow key={connection.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{connection.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {connection.id} · r{connection.revision}
                    </p>
                  </TableCell>
                  <TableCell>Prometheus-compatible</TableCell>
                  <TableCell>
                    <p className="max-w-64 truncate font-mono text-xs">
                      {safeEndpointSummary(connection.endpoint)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        `releaseHealth.connections.auth.${connection.authentication.type}`
                      )}
                    </p>
                  </TableCell>
                  <TableCell>
                    <ConnectionStatusBadge status={connection.status} />
                  </TableCell>
                  <TableCell>
                    {t("releaseHealth.connections.bindingCount", {
                      count: connection.usedByBindings,
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {connection.lastCheckedAt}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(connection)}
                      >
                        <Play />
                        {t("releaseHealth.connections.test")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("releaseHealth.connections.edit", {
                          name: connection.name,
                        })}
                        onClick={() => openEdit(connection)}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 text-center text-muted-foreground"
                  >
                    {t("releaseHealth.connections.empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

      <SourceConnectionSheet
        key={editing?.id ?? "new-connection"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        environmentKey={environmentKey}
        environmentName={environmentName}
        connection={editing}
        onSaved={saveConnection}
      />
    </ReleaseHealthShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  )
}

function ConnectionStatusBadge({
  status,
}: {
  status: MetricSourceConnectionStatus
}) {
  const { t } = useTranslation()
  const Icon =
    status === "connected"
      ? CheckCircle2
      : status === "unavailable"
        ? TriangleAlert
        : CircleOff
  return (
    <Badge
      variant={status === "connected" ? "secondary" : "outline"}
      className="font-normal"
    >
      <Icon />
      {t(`releaseHealth.connections.statusValue.${status}`)}
    </Badge>
  )
}

function safeEndpointSummary(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`
  } catch {
    return endpoint
  }
}
