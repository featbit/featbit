import { Check, Copy, Pencil } from "lucide-react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { policyResourceName } from "../../policy-api"
import { updatePolicySettings, type PolicyDetail } from "../policy-details-api"

export function PolicyDetailsHeader({
  policy,
  loading,
  error,
  onRetry,
  onPolicyChange,
  onRemove,
}: {
  policy: PolicyDetail | null
  loading: boolean
  error: boolean
  onRetry: () => void
  onPolicyChange: (policy: PolicyDetail) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [descriptionEditing, setDescriptionEditing] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [descriptionSaving, setDescriptionSaving] = useState(false)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [resourceCopied, setResourceCopied] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    },
    []
  )

  const readonly = policy?.type === "SysManaged"
  const resourceName = policy ? policyResourceName(policy) : ""
  const nameChanged = nameDraft.trim() !== (policy?.name ?? "").trim()
  const descriptionChanged =
    descriptionDraft.trim() !== (policy?.description ?? "").trim()

  function startNameEdit() {
    if (!policy || readonly) return
    setNameDraft(policy.name)
    setNameError(null)
    setNameEditing(true)
  }

  function cancelNameEdit() {
    setNameDraft(policy?.name ?? "")
    setNameError(null)
    setNameEditing(false)
  }

  async function saveName() {
    if (!policy || !nameChanged) return
    const nextName = nameDraft.trim()
    if (!nextName) {
      setNameError(t("iam.policies.nameRequired"))
      return
    }
    setNameSaving(true)
    setNameError(null)
    try {
      const updated = await updatePolicySettings({
        ...policy,
        name: nextName,
      })
      onPolicyChange(updated)
      setNameEditing(false)
      toast.success(t("iam.policies.operationSucceeded"))
    } catch {
      setNameError(
        t("iam.policies.details.nameUpdateFailed", {
          defaultValue: "Failed to update policy name.",
        })
      )
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setNameSaving(false)
    }
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancelNameEdit()
    }
    if (event.key === "Enter") {
      event.preventDefault()
      void saveName()
    }
  }

  function startDescriptionEdit() {
    if (!policy || readonly) return
    setDescriptionDraft(policy.description ?? "")
    setDescriptionError(null)
    setDescriptionEditing(true)
  }

  function cancelDescriptionEdit() {
    setDescriptionDraft(policy?.description ?? "")
    setDescriptionError(null)
    setDescriptionEditing(false)
  }

  async function saveDescription() {
    if (!policy || !descriptionChanged) return
    setDescriptionSaving(true)
    setDescriptionError(null)
    try {
      const updated = await updatePolicySettings({
        ...policy,
        description: descriptionDraft.trim(),
      })
      onPolicyChange(updated)
      setDescriptionEditing(false)
      toast.success(t("iam.policies.operationSucceeded"))
    } catch {
      setDescriptionError(
        t("iam.policies.details.descriptionUpdateFailed", {
          defaultValue: "Failed to update policy description.",
        })
      )
      toast.error(t("iam.policies.operationFailed"))
    } finally {
      setDescriptionSaving(false)
    }
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancelDescriptionEdit()
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void saveDescription()
    }
  }

  async function copyResourceName() {
    if (!resourceName) return
    await navigator.clipboard.writeText(resourceName)
    setResourceCopied(true)
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setResourceCopied(false)
      copyTimeoutRef.current = null
    }, 1500)
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {t("iam.policies.details.loadFailed", {
          defaultValue: "Failed to load policy details",
        })}
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("iam.policies.retry")}
        </Button>
      </div>
    )
  }

  return (
    <header className="flex min-h-32 items-start justify-between gap-6">
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-8 w-96" />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          {nameEditing ? (
            <div className="w-full max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={nameDraft}
                  disabled={nameSaving}
                  aria-invalid={Boolean(nameError)}
                  className="max-w-xl text-base font-semibold"
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={handleNameKeyDown}
                />
                <Button variant="ghost" size="sm" onClick={cancelNameEdit}>
                  {t("iam.policies.cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={nameSaving || !nameChanged}
                  onClick={() => void saveName()}
                >
                  {nameSaving
                    ? t("iam.policies.saving")
                    : t("iam.policies.save")}
                </Button>
              </div>
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex max-w-2xl items-end gap-1.5">
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-normal">
                {policy?.name || t("iam.policies.name")}
              </h1>
              {!readonly ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 text-muted-foreground"
                        aria-label={t("iam.policies.details.editName", {
                          defaultValue: "Edit policy name",
                        })}
                        onClick={startNameEdit}
                      />
                    }
                  >
                    <Pencil className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("iam.policies.details.editName", {
                      defaultValue: "Edit policy name",
                    })}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          )}

          {descriptionEditing ? (
            <div className="mt-2 w-full max-w-2xl space-y-2">
              <Textarea
                autoFocus
                rows={3}
                value={descriptionDraft}
                disabled={descriptionSaving}
                aria-invalid={Boolean(descriptionError)}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onKeyDown={handleDescriptionKeyDown}
              />
              {descriptionError ? (
                <p className="text-sm text-destructive">{descriptionError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelDescriptionEdit}
                >
                  {t("iam.policies.cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={descriptionSaving || !descriptionChanged}
                  onClick={() => void saveDescription()}
                >
                  {descriptionSaving
                    ? t("iam.policies.saving")
                    : t("iam.policies.save")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex max-w-2xl items-end gap-1.5">
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {policy?.description ||
                  t("iam.policies.details.addDescription", {
                    defaultValue: "Add description",
                  })}
              </p>
              {!readonly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground"
                  aria-label={t("iam.policies.details.editDescription", {
                    defaultValue: "Edit description",
                  })}
                  onClick={startDescriptionEdit}
                >
                  <Pencil className="size-3" />
                </Button>
              ) : null}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted/60 pr-0.5 pl-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                RN
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <code
                      tabIndex={0}
                      className="max-w-[360px] min-w-0 truncate rounded-sm px-1 font-mono text-xs leading-5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                  }
                >
                  {resourceName}
                </TooltipTrigger>
                <TooltipContent className="max-w-[min(28rem,calc(100vw-2rem))] font-mono break-all">
                  {resourceName}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 shrink-0 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                      aria-label={t("iam.policies.copyResourceName")}
                      onClick={() => void copyResourceName()}
                    />
                  }
                >
                  {resourceCopied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {resourceCopied
                    ? t("iam.policies.copied")
                    : t("iam.policies.copyResourceName")}
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="secondary" className="h-7 px-2.5 font-normal">
              {readonly
                ? t("iam.policies.systemManaged")
                : t("iam.policies.customerManaged")}
            </Badge>
          </div>
        </div>
      )}

      {!readonly ? (
        <Button
          type="button"
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive"
          disabled={!policy}
          onClick={onRemove}
        >
          {t("iam.policies.removePolicyTitle")}
        </Button>
      ) : null}
    </header>
  )
}
