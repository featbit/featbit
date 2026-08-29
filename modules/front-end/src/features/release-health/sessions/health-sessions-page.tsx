import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { ReleaseHealthShell } from "../components/release-health-shell"
import { DataStatusBadge, GateStatusBadge } from "../components/status-badges"
import { sessionSampleText } from "../release-health-display"
import { healthSessions } from "../release-health-mock-data"

type SessionFilter = "all" | "active" | "completed" | "attention"

export function HealthSessionsPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<SessionFilter>("all")
  const sessions = useMemo(
    () =>
      healthSessions.filter((session) => {
        const matchesSearch =
          !search.trim() ||
          `${session.displayId} ${sessionSampleText(t, session, "flagName")} ${session.flagName} ${session.flagKey} ${sessionSampleText(t, session, "monitorName")}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        const matchesStatus =
          status === "all" ||
          (status === "attention"
            ? session.gateStatus === "breached" ||
              session.gateStatus === "approval-required"
            : session.status === status)
        return matchesSearch && matchesStatus
      }),
    [search, status, t]
  )

  return (
    <ReleaseHealthShell activeTab="sessions">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              className="pl-9"
              placeholder={t("releaseHealth.sessions.search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) =>
              value && setStatus(value as SessionFilter)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue>
                {t(`releaseHealth.sessions.filters.${status}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(["all", "active", "completed", "attention"] as const).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {t(`releaseHealth.sessions.filters.${value}`)}
                    </SelectItem>
                  )
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 md:hidden">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-md border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    to={localizedPath(
                      lang,
                      `/release-health/sessions/${session.id}`
                    )}
                    className="font-medium hover:underline"
                  >
                    {session.displayId}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {sessionSampleText(t, session, "monitorName")}
                  </p>
                </div>
                <GateStatusBadge status={session.gateStatus} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("releaseHealth.sessions.flag")}
                  </p>
                  <p className="font-medium">
                    {sessionSampleText(t, session, "flagName")}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {session.flagKey}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("releaseHealth.sessions.change")}
                  </p>
                  <p>{sessionSampleText(t, session, "changeSummary")}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                <DataStatusBadge status={session.dataStatus} />
                <Badge variant="outline" className="font-normal">
                  {sessionSampleText(t, session, "triggerLabel")}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(session.startedAt))}
                </span>
              </div>
            </div>
          ))}
          {!sessions.length ? (
            <div className="rounded-md border py-16 text-center text-sm text-muted-foreground">
              {t("releaseHealth.sessions.empty")}
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-hidden rounded-md border bg-background md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">
                  {t("releaseHealth.sessions.session")}
                </TableHead>
                <TableHead>{t("releaseHealth.sessions.flag")}</TableHead>
                <TableHead>{t("releaseHealth.sessions.trigger")}</TableHead>
                <TableHead>{t("releaseHealth.sessions.change")}</TableHead>
                <TableHead>{t("releaseHealth.sessions.data")}</TableHead>
                <TableHead>{t("releaseHealth.sessions.gate")}</TableHead>
                <TableHead>{t("releaseHealth.sessions.action")}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t("releaseHealth.sessions.started")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="pl-4">
                    <Link
                      to={localizedPath(
                        lang,
                        `/release-health/sessions/${session.id}`
                      )}
                      className="font-medium text-foreground hover:underline"
                    >
                      {session.displayId}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {sessionSampleText(t, session, "monitorName")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={localizedPath(
                        lang,
                        `/feature-flags/${encodeURIComponent(
                          session.flagKey
                        )}/release-health`
                      )}
                      className="font-medium hover:underline"
                    >
                      {sessionSampleText(t, session, "flagName")}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      {session.flagKey}
                    </p>
                  </TableCell>
                  <TableCell>
                    {sessionSampleText(t, session, "triggerLabel")}
                  </TableCell>
                  <TableCell>
                    <p className="max-w-64 truncate">
                      {sessionSampleText(t, session, "changeSummary")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <DataStatusBadge status={session.dataStatus} />
                  </TableCell>
                  <TableCell>
                    <GateStatusBadge status={session.gateStatus} />
                  </TableCell>
                  <TableCell>
                    {session.gateStatus === "approval-required" ? (
                      <Badge
                        variant="secondary"
                        className="border-amber-300 bg-amber-50 font-normal text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                      >
                        {t("releaseHealth.sessions.approvalRequired")}
                      </Badge>
                    ) : session.gateStatus === "breached" ? (
                      <span className="text-sm text-muted-foreground">
                        {t("releaseHealth.sessions.alertSent")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground">
                    {new Intl.DateTimeFormat(
                      lang === "zh" ? "zh-CN" : "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    ).format(new Date(session.startedAt))}
                  </TableCell>
                </TableRow>
              ))}
              {!sessions.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-40 text-center text-muted-foreground"
                  >
                    {t("releaseHealth.sessions.empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </ReleaseHealthShell>
  )
}
