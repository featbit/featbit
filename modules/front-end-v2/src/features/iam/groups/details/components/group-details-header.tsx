import { Check, Copy, Pencil } from "lucide-react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  groupResourceName,
  isGroupNameUsed,
  updateGroup,
  type Group,
} from "../../group-api"

export function GroupDetailsHeader({
  group,
  loading,
  error,
  onRetry,
  onGroupChange,
  onRemove,
}: {
  group: Group | null
  loading: boolean
  error: boolean
  onRetry: () => void
  onGroupChange: (group: Group) => void
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

  const resourceName = group ? groupResourceName(group) : ""
  const nameChanged = nameDraft.trim() !== (group?.name ?? "").trim()
  const descriptionChanged =
    descriptionDraft.trim() !== (group?.description ?? "").trim()

  function startNameEdit() {
    if (!group) return
    setNameDraft(group.name)
    setNameError(null)
    setNameEditing(true)
  }

  function cancelNameEdit() {
    setNameDraft(group?.name ?? "")
    setNameError(null)
    setNameEditing(false)
  }

  async function saveName() {
    if (!group || !nameChanged) return
    const nextName = nameDraft.trim()
    if (!nextName) {
      setNameError(t("iam.groups.groupNameRequired"))
      return
    }
    setNameSaving(true)
    setNameError(null)
    try {
      if (await isGroupNameUsed(nextName)) {
        setNameError(t("iam.groups.groupNameUnavailable"))
        return
      }
      const updatedGroup = await updateGroup({
        id: group.id,
        name: nextName,
        description: group.description,
      })
      onGroupChange(updatedGroup)
      setNameDraft(updatedGroup.name)
      setNameEditing(false)
      toast.success(t("iam.groups.operationSucceeded"))
    } catch {
      setNameError(t("iam.groups.groupNameUpdateFailed"))
      toast.error(t("iam.groups.operationFailed"))
    } finally {
      setNameSaving(false)
    }
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancelNameEdit()
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      void saveName()
    }
  }

  function startDescriptionEdit() {
    if (!group) return
    setDescriptionDraft(group.description ?? "")
    setDescriptionError(null)
    setDescriptionEditing(true)
  }

  function cancelDescriptionEdit() {
    setDescriptionDraft(group?.description ?? "")
    setDescriptionError(null)
    setDescriptionEditing(false)
  }

  async function saveDescription() {
    if (!group || !descriptionChanged) return
    setDescriptionSaving(true)
    setDescriptionError(null)
    try {
      const updatedGroup = await updateGroup({
        id: group.id,
        name: group.name,
        description: descriptionDraft.trim(),
      })
      onGroupChange(updatedGroup)
      setDescriptionDraft(updatedGroup.description ?? "")
      setDescriptionEditing(false)
      toast.success(t("iam.groups.operationSucceeded"))
    } catch {
      setDescriptionError(t("iam.groups.descriptionUpdateFailed"))
      toast.error(t("iam.groups.operationFailed"))
    } finally {
      setDescriptionSaving(false)
    }
  }

  function handleDescriptionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancelDescriptionEdit()
      return
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
        {t("iam.groups.detailLoadFailed")}
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("iam.groups.retry")}
        </Button>
      </div>
    )
  }

  return (
    <header className="flex min-h-28 items-start justify-between gap-6">
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-8 w-80" />
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={nameSaving}
                  onClick={cancelNameEdit}
                >
                  {t("iam.groups.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={nameSaving || !nameChanged}
                  onClick={() => void saveName()}
                >
                  {nameSaving ? t("iam.groups.saving") : t("iam.groups.save")}
                </Button>
              </div>
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex max-w-2xl items-end gap-1.5">
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-normal">
                {group?.name || t("iam.groups.noName")}
              </h1>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 shrink-0 text-muted-foreground"
                      aria-label={t("iam.groups.editGroupName")}
                      disabled={descriptionEditing}
                      onClick={startNameEdit}
                    />
                  }
                >
                  <Pencil className="size-3" />
                </TooltipTrigger>
                <TooltipContent>{t("iam.groups.editGroupName")}</TooltipContent>
              </Tooltip>
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
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={descriptionSaving}
                  onClick={cancelDescriptionEdit}
                >
                  {t("iam.groups.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={descriptionSaving || !descriptionChanged}
                  onClick={() => void saveDescription()}
                >
                  {descriptionSaving
                    ? t("iam.groups.saving")
                    : t("iam.groups.save")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex max-w-2xl items-end gap-1.5">
              {group?.description ? (
                <p className="min-w-0 truncate text-sm text-muted-foreground">
                  {group.description}
                </p>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-sm font-normal text-muted-foreground hover:text-foreground disabled:no-underline"
                  disabled={nameEditing}
                  onClick={startDescriptionEdit}
                >
                  {t("iam.groups.addDescription")}
                </Button>
              )}
              {group?.description ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 shrink-0 text-muted-foreground"
                        aria-label={t("iam.groups.editDescription")}
                        disabled={nameEditing}
                        onClick={startDescriptionEdit}
                      />
                    }
                  >
                    <Pencil className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("iam.groups.editDescription")}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          )}

          <div className="mt-3 inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted/60 pr-0.5 pl-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              RN
            </span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <code
                    tabIndex={0}
                    className="max-w-[360px] min-w-0 truncate rounded-sm px-1 font-mono text-xs leading-5 font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                    aria-label={t("iam.groups.copyResourceName")}
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
                  ? t("iam.groups.copied")
                  : t("iam.groups.copyResourceName")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive"
        disabled={!group}
        onClick={onRemove}
      >
        {t("iam.groups.removeGroup")}
      </Button>
    </header>
  )
}
