import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Pencil, Play, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCurrentProjectEnv } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { SourceConnectionSheet } from "../components/source-connection-sheet"
import {
  connectionForEditor,
  releaseHealthApi,
  type PrometheusConnectionView,
} from "../release-health-api"

export function SourceConnectionsPage() {
  const context = getCurrentProjectEnv()
  return context ? (
    <Connections
      key={`${context.projectId}:${context.envId}`}
      context={context}
    />
  ) : null
}
function Connections({
  context,
}: {
  context: NonNullable<ReturnType<typeof getCurrentProjectEnv>>
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const queryKey = [
    "release-health",
    context.projectId,
    context.envId,
    "connections",
  ]
  const query = useQuery({
    queryKey,
    queryFn: () => releaseHealthApi.connections(context),
    retry: false,
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PrometheusConnectionView>()
  const [testing, setTesting] = useState<string>()
  async function test(connection: PrometheusConnectionView) {
    setTesting(connection.id)
    try {
      await releaseHealthApi.testSaved(context, connection.id)
      await client.invalidateQueries({ queryKey })
      toast.success(t("releaseHealth.live.testPassed"))
    } catch {
      toast.error(t("releaseHealth.live.connectionFailed"))
    } finally {
      setTesting(undefined)
      void client.invalidateQueries({ queryKey })
    }
  }
  return (
    <ReleaseHealthShell activeTab="connections" live>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.live.connectionScope")}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => query.refetch()}>
              <RefreshCw />
              {t("releaseHealth.live.refresh")}
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined)
                setOpen(true)
              }}
            >
              <Plus />
              {t("releaseHealth.connections.add")}
            </Button>
          </div>
        </div>
        {query.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t("releaseHealth.live.loadFailed")}
            </AlertDescription>
          </Alert>
        ) : null}
        {query.isPending ? <p>{t("releaseHealth.live.loading")}</p> : null}
        {!query.isError && query.data?.length === 0 ? (
          <div className="rounded-lg border p-10 text-center text-muted-foreground">
            {t("releaseHealth.connections.empty")}
          </div>
        ) : null}
        {!query.isError &&
          query.data?.map((connection) => (
            <section key={connection.id} className="rounded-lg border p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="font-semibold">
                    {connection.name}{" "}
                    <Badge variant="secondary">
                      Prometheus-compatible · v
                      {connection.providerSchemaVersion}
                    </Badge>
                  </h2>
                  <p className="font-mono text-xs break-all">
                    {connection.providerConfig.endpoint}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      `releaseHealth.connections.auth.${connection.authentication.type}`
                    )}{" "}
                    · r{connection.revision} ·{" "}
                    {t("releaseHealth.connections.lastChecked")}:{" "}
                    {new Date(connection.lastCheckedAt).toLocaleString()}
                  </p>
                  <Badge variant="outline">
                    {t(
                      `releaseHealth.connections.statusValue.${connection.status}`
                    )}
                  </Badge>
                  {connection.authentication.type !== "none" ? (
                    <Badge variant="outline">
                      {t("releaseHealth.live.encrypted")}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={Boolean(testing)}
                    onClick={() => test(connection)}
                  >
                    <Play />
                    {t("releaseHealth.connections.test")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(connection)
                      setOpen(true)
                    }}
                  >
                    <Pencil />
                    {t("releaseHealth.live.edit")}
                  </Button>
                </div>
              </div>
            </section>
          ))}
      </div>
      <SourceConnectionSheet
        open={open}
        onOpenChange={setOpen}
        environmentKey={context.envKey}
        environmentName={context.envName}
        liveScope={context}
        connection={
          editing ? connectionForEditor(editing, context.envKey) : undefined
        }
        onSaved={() => {
          void client.invalidateQueries({ queryKey })
        }}
      />
    </ReleaseHealthShell>
  )
}
