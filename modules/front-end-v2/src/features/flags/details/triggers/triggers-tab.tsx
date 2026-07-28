import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreateTriggerDialog } from "./create-trigger-dialog"
import {
  TriggerConfirmDialog,
  type TriggerConfirmation,
} from "./trigger-confirm-dialog"
import { TriggerTableRow } from "./trigger-table-row"
import {
  createFlagTrigger,
  fetchFlagTriggers,
  flagTriggerUrl,
  removeFlagTrigger,
  resetFlagTriggerUrl,
  updateFlagTriggerStatus,
  type CreateFlagTriggerInput,
  type FlagTrigger,
} from "./triggers-api"

export function TriggersTab({
  flagId,
  archived,
}: {
  flagId: string
  archived: boolean
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = i18n.resolvedLanguage || "en"
  const queryKey = ["flag-triggers", flagId] as const
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmation, setConfirmation] = useState<TriggerConfirmation>(null)
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>(
    {}
  )

  const triggersQuery = useQuery({
    queryKey,
    queryFn: () => fetchFlagTriggers(flagId),
    enabled: Boolean(flagId),
  })

  function replaceTrigger(
    id: string,
    update: (value: FlagTrigger) => FlagTrigger
  ) {
    queryClient.setQueryData(queryKey, (current: FlagTrigger[] | undefined) =>
      (current ?? []).map((trigger) =>
        trigger.id === id ? update(trigger) : trigger
      )
    )
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateFlagTriggerInput) => createFlagTrigger(input),
    onSuccess: (trigger) => {
      queryClient.setQueryData(
        queryKey,
        (current: FlagTrigger[] | undefined) => [trigger, ...(current ?? [])]
      )
      if (trigger.token) {
        setRevealedTokens((current) => ({
          ...current,
          [trigger.id]: trigger.token!,
        }))
      }
      setCreateOpen(false)
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      updateFlagTriggerStatus(id, isEnabled),
    onSuccess: (_, variables) => {
      replaceTrigger(variables.id, (trigger) => ({
        ...trigger,
        isEnabled: variables.isEnabled,
        updatedAt: new Date().toISOString(),
      }))
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  const resetMutation = useMutation({
    mutationFn: (id: string) => resetFlagTriggerUrl(id),
    onSuccess: (token, id) => {
      setRevealedTokens((current) => ({ ...current, [id]: token }))
      replaceTrigger(id, (trigger) => ({
        ...trigger,
        token,
        updatedAt: new Date().toISOString(),
      }))
      setConfirmation(null)
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFlagTrigger(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(queryKey, (current: FlagTrigger[] | undefined) =>
        (current ?? []).filter((trigger) => trigger.id !== id)
      )
      setRevealedTokens((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      setConfirmation(null)
      toast.success(t("featureFlags.operationSucceeded"))
    },
    onError: () => toast.error(t("featureFlags.operationFailed")),
  })

  async function copyUrl(trigger: FlagTrigger) {
    const token = revealedTokens[trigger.id]
    if (!token) return
    try {
      await navigator.clipboard.writeText(flagTriggerUrl(token))
      toast.success(t("featureFlags.detailsPage.triggers.copied"))
    } catch {
      toast.error(t("featureFlags.detailsPage.triggers.copyFailed"))
    }
  }

  const triggers = triggersQuery.data ?? []
  const busyConfirmation = resetMutation.isPending || removeMutation.isPending
  const editable = !archived

  return (
    <div className="pt-3">
      <div className="flex min-h-12 items-center justify-end">
        {editable ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("featureFlags.detailsPage.triggers.add")}
          </Button>
        ) : null}
      </div>

      <section className="mt-1 space-y-3">
        <div>
          <h2 className="text-base font-semibold">
            {t("featureFlags.detailsPage.triggers.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("featureFlags.detailsPage.triggers.help")}
          </p>
        </div>

        {triggersQuery.isError ? (
          <div className="flex min-h-40 items-center justify-between gap-4 rounded-lg border px-5 text-sm">
            <span className="text-destructive">
              {t("featureFlags.detailsPage.triggers.loadFailed")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void triggersQuery.refetch()}
            >
              {t("featureFlags.retry")}
            </Button>
          </div>
        ) : triggersQuery.isLoading ? (
          <TriggersSkeleton />
        ) : triggers.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border px-6 text-center">
            <p className="text-sm font-medium">
              {t("featureFlags.detailsPage.triggers.empty")}
            </p>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              {t("featureFlags.detailsPage.triggers.emptyHelp")}
            </p>
            {editable ? (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus />
                {t("featureFlags.detailsPage.triggers.add")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table className="min-w-[1120px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[19%] px-4">
                    {t("featureFlags.detailsPage.triggers.type")}
                  </TableHead>
                  <TableHead className="w-[13%]">
                    {t("featureFlags.detailsPage.triggers.action")}
                  </TableHead>
                  <TableHead className="w-[10%]">
                    {t("featureFlags.detailsPage.triggers.status")}
                  </TableHead>
                  <TableHead className="w-[31%]">
                    {t("featureFlags.detailsPage.triggers.url")}
                  </TableHead>
                  <TableHead className="w-[13%]">
                    {t("featureFlags.detailsPage.triggers.usage")}
                  </TableHead>
                  <TableHead className="w-[14%] px-4">
                    {t("featureFlags.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triggers.map((trigger) => {
                  const token = revealedTokens[trigger.id]
                  const toggling =
                    toggleMutation.isPending &&
                    toggleMutation.variables?.id === trigger.id
                  return (
                    <TriggerTableRow
                      key={trigger.id}
                      trigger={trigger}
                      token={token}
                      locale={locale}
                      editable={editable}
                      toggling={toggling}
                      onToggle={(isEnabled) =>
                        toggleMutation.mutate({
                          id: trigger.id,
                          isEnabled,
                        })
                      }
                      onCopy={() => void copyUrl(trigger)}
                      onConfirm={setConfirmation}
                    />
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <CreateTriggerDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        targetId={flagId}
        saving={createMutation.isPending}
        onOpenChange={setCreateOpen}
        onCreate={(input) => createMutation.mutate(input)}
      />
      <TriggerConfirmDialog
        target={confirmation}
        saving={busyConfirmation}
        onOpenChange={(open) => !open && setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return
          if (confirmation.kind === "reset") {
            resetMutation.mutate(confirmation.trigger.id)
          } else {
            removeMutation.mutate(confirmation.trigger.id)
          }
        }}
      />
    </div>
  )
}

function TriggersSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid min-w-[1120px] grid-cols-[19%_13%_10%_31%_13%_14%] border-b bg-muted/30 px-4 py-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-16" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="grid min-w-[1120px] grid-cols-[19%_13%_10%_31%_13%_14%] items-center border-b px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-8 w-[90%]" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  )
}
