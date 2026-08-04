import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AgentAvailability, RelayProxyAgent } from "../relay-proxy-types"

type Props = {
  open: boolean
  agent: RelayProxyAgent | null
  onOpenChange: (open: boolean) => void
  onCheck: (host: string) => Promise<AgentAvailability>
  onSave: (agent: RelayProxyAgent) => void
}

export function ManualAgentDialog({
  open,
  agent,
  onOpenChange,
  onCheck,
  onSave,
}: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(agent?.name ?? "")
  const [host, setHost] = useState(agent?.host ?? "")
  const [availability, setAvailability] = useState<AgentAvailability | null>(
    null
  )
  const [checking, setChecking] = useState(false)
  const validUrl = (() => {
    try {
      return Boolean(new URL(host))
    } catch {
      return false
    }
  })()

  async function check() {
    if (!host.trim()) return
    setChecking(true)
    try {
      setAvailability(await onCheck(host.trim()))
    } finally {
      setChecking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(
              agent
                ? "relayProxies.manualAgent.editTitle"
                : "relayProxies.manualAgent.addTitle"
            )}
          </DialogTitle>
          <DialogDescription>
            {t("relayProxies.manualAgent.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="agent-name">
              {t("relayProxies.manualAgent.name")}
            </Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("relayProxies.manualAgent.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-host">
              {t("relayProxies.manualAgent.url")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="agent-host"
                value={host}
                onChange={(event) => {
                  setHost(event.target.value)
                  setAvailability(null)
                }}
                placeholder={t("relayProxies.manualAgent.urlPlaceholder")}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!host.trim() || checking}
                onClick={check}
              >
                {t(
                  checking
                    ? "relayProxies.manualAgent.checking"
                    : "relayProxies.manualAgent.check"
                )}
              </Button>
            </div>
            {availability !== null && (
              <p
                className={
                  availability === 200
                    ? "text-xs text-emerald-700"
                    : "text-xs text-destructive"
                }
              >
                {t(
                  availability === 200
                    ? "relayProxies.manualAgent.available"
                    : availability === 404
                      ? "relayProxies.manualAgent.notFound"
                      : "relayProxies.manualAgent.unavailable",
                  { status: availability }
                )}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="border-t-0 bg-transparent">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("relayProxies.manualAgent.cancel")}
          </Button>
          <Button
            disabled={!name.trim() || !validUrl}
            onClick={() => {
              onSave({
                id: agent?.id ?? crypto.randomUUID(),
                name: name.trim(),
                host: host.trim(),
                serves: agent?.serves ?? "",
                syncAt: agent?.syncAt,
                dataVersion: agent?.dataVersion,
                createdAt: agent?.createdAt,
              })
              onOpenChange(false)
            }}
          >
            {t(
              agent
                ? "relayProxies.manualAgent.save"
                : "relayProxies.manualAgent.add"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
