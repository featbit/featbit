import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  releaseHealthApi,
  type PrometheusConnectionView,
  type ReleaseHealthScope,
} from "../release-health-api"

export function SourceConnectionSelect({
  scope,
  connections,
  value,
  onValueChange,
  disabled,
}: {
  scope: ReleaseHealthScope
  connections: PrometheusConnectionView[]
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const connection = connections.find((item) => item.id === value)
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <Label htmlFor="live-binding-connection">
          {t("releaseHealth.metrics.sourceBinding.selectConnection")}
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={value}
            disabled={disabled || !connections.length}
            onValueChange={(next) => next && onValueChange(next)}
          >
            <SelectTrigger
              id="live-binding-connection"
              className="w-full sm:w-80 lg:w-96"
            >
              <SelectValue>{connection?.name ?? "—"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {connections.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <ConnectionTest
            key={`${scope.projectId}:${scope.envId}:${connection?.id}:${connection?.revision}`}
            scope={scope}
            connectionId={connection?.id}
            disabled={disabled}
          />
        </div>
        {!connections.length && (
          <p className="text-sm text-muted-foreground">
            {t("releaseHealth.metrics.sourceBinding.noConnections")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ConnectionTest({
  scope,
  connectionId,
  disabled,
}: {
  scope: ReleaseHealthScope
  connectionId?: string
  disabled: boolean
}) {
  const { t, i18n } = useTranslation()
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ passed: boolean; at: Date }>()
  const s = (key: string) => t(`releaseHealth.metrics.sourceBinding.${key}`)
  async function testConnection() {
    if (!connectionId || testing) return
    setTesting(true)
    setResult(undefined)
    try {
      const passed = await releaseHealthApi.testSaved(scope, connectionId)
      setResult({ passed, at: new Date() })
    } catch {
      setResult({ passed: false, at: new Date() })
    } finally {
      setTesting(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={!connectionId || disabled || testing}
        onClick={testConnection}
      >
        {testing && <LoaderCircle aria-hidden className="animate-spin" />}
        {t("releaseHealth.connections.test")}
      </Button>
      {testing || result ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          {testing ? (
            <span className="text-muted-foreground">{s("testing")}</span>
          ) : result ? (
            <>
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${result.passed ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
              >
                {result.passed ? (
                  <CircleCheck aria-hidden className="size-4" />
                ) : (
                  <CircleX aria-hidden className="size-4" />
                )}
                {s(result.passed ? "testPassed" : "testFailed")}
              </span>
              <time
                dateTime={result.at.toISOString()}
                title={result.at.toLocaleString()}
                className="text-muted-foreground tabular-nums"
              >
                {s("testedAt")}{" "}
                {result.at.toLocaleTimeString(i18n.resolvedLanguage, {
                  hour12: false,
                })}
              </time>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
