import { useMutation, useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleX,
  Loader2,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getCurrentProjectEnv,
  fetchProjects,
} from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { copyFeatureFlags, precheckCopyFeatureFlags } from "../flags-api"
import type { FeatureFlag } from "../flags-types"

export function CopyFlagsDialog({
  lang,
  envId,
  flags,
  open,
  onOpenChange,
  onSuccess,
}: {
  lang: Lang
  envId: string
  flags: FeatureFlag[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const zh = lang === "zh"
  const source = getCurrentProjectEnv()
  const [targetEnvId, setTargetEnvId] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionTouched, setSelectionTouched] = useState(false)
  const projectsQuery = useQuery({
    queryKey: ["projects", "flag-copy"],
    queryFn: fetchProjects,
    enabled: open,
    staleTime: 60_000,
  })
  const precheckQuery = useQuery({
    queryKey: [
      "feature-flag-copy-precheck",
      envId,
      targetEnvId,
      flags.map((flag) => flag.id).join(","),
    ],
    queryFn: () =>
      precheckCopyFeatureFlags(
        envId,
        targetEnvId,
        flags.map((flag) => flag.id)
      ),
    enabled: open && Boolean(targetEnvId) && flags.length > 0,
  })
  const results = useMemo(
    () =>
      new Map((precheckQuery.data ?? []).map((result) => [result.id, result])),
    [precheckQuery.data]
  )

  const defaultSelectedIds = useMemo(
    () =>
      new Set(
        (precheckQuery.data ?? [])
          .filter((result) => result.passed && result.keyCheck)
          .map((result) => result.id)
      ),
    [precheckQuery.data]
  )
  const activeSelectedIds = selectionTouched ? selectedIds : defaultSelectedIds

  const mutation = useMutation({
    mutationFn: () =>
      copyFeatureFlags(
        envId,
        targetEnvId,
        [...activeSelectedIds],
        precheckQuery.data ?? []
      ),
    onSuccess: (result) => {
      toast.success(
        zh
          ? `已复制 ${result.copiedCount} 个功能开关`
          : `${result.copiedCount} feature flags copied`
      )
      onSuccess()
      onOpenChange(false)
    },
    onError: () =>
      toast.error(zh ? "复制失败，请重试。" : "Copy failed. Please try again."),
  })
  const targetProjects = (projectsQuery.data ?? [])
    .map((project) => ({
      ...project,
      environments: project.environments.filter(
        (environment) => environment.id !== envId
      ),
    }))
    .filter((project) => project.environments.length)
  const selectedCount = activeSelectedIds.size

  function toggle(id: string, allowed: boolean) {
    if (!allowed || mutation.isPending) return
    setSelectedIds(() => {
      const next = new Set(activeSelectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectionTouched(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{zh ? "复制到环境" : "Copy to environment"}</DialogTitle>
          <DialogDescription>
            {zh
              ? "选择目标环境并检查可复制的内容。"
              : "Choose a target environment and review what can be copied."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {zh ? "来源" : "Source"}
              </p>
              <div className="flex h-8 items-center rounded-md border bg-muted/40 px-3 text-sm">
                {source?.projectName} / {source?.envName}
              </div>
            </div>
            <ArrowRight className="mb-2 size-4 text-muted-foreground" />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {zh ? "目标环境" : "Target environment"}
              </p>
              <Select
                value={targetEnvId}
                onValueChange={(value) => {
                  setTargetEnvId(value ?? "")
                  setSelectedIds(new Set())
                  setSelectionTouched(false)
                }}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={zh ? "选择环境" : "Select environment"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetProjects.map((project) => (
                    <SelectGroup key={project.id}>
                      <SelectLabel>{project.name}</SelectLabel>
                      {project.environments.map((environment) => (
                        <SelectItem key={environment.id} value={environment.id}>
                          {project.name} / {environment.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {zh ? "要复制的功能开关" : "Flags to copy"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {selectedCount} / {flags.length}
              </span>
            </div>
            <div className="overflow-hidden rounded-md border">
              {flags.map((flag) => {
                const result = results.get(flag.id)
                const blocked = Boolean(result && !result.keyCheck)
                const warning = Boolean(
                  result && result.keyCheck && !result.passed
                )
                const allowed = Boolean(result && result.keyCheck)
                return (
                  <div
                    key={flag.id}
                    className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0"
                  >
                    <Checkbox
                      checked={activeSelectedIds.has(flag.id)}
                      disabled={!allowed || mutation.isPending}
                      onCheckedChange={() => toggle(flag.id, allowed)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {flag.name}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {flag.key}
                      </p>
                      {warning && result?.newProperties?.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {result.newProperties.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {!targetEnvId ? (
                      <span className="text-xs text-muted-foreground">
                        {zh ? "等待选择环境" : "Choose a target"}
                      </span>
                    ) : precheckQuery.isLoading ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : blocked ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                        <CircleX className="size-4" />
                        {zh ? "目标中已存在" : "Already exists"}
                      </span>
                    ) : warning ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                        onClick={() => toggle(flag.id, true)}
                      >
                        <AlertTriangle className="size-4" />
                        {zh ? "有限制，仍然复制" : "Limitations · Copy anyway"}
                      </button>
                    ) : result ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" />
                        {zh ? "可以复制" : "Ready to copy"}
                      </span>
                    ) : (
                      <span className="text-xs text-destructive">
                        {precheckQuery.isError
                          ? zh
                            ? "检查失败"
                            : "Check failed"
                          : ""}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="m-0 rounded-none px-6 py-4">
          <span className="mr-auto self-center text-sm text-muted-foreground">
            {selectedCount
              ? zh
                ? `已选择 ${selectedCount} 个`
                : `${selectedCount} flags selected`
              : zh
                ? "未选择功能开关"
                : "No flags selected"}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {zh ? "取消" : "Cancel"}
          </Button>
          <Button
            type="button"
            disabled={
              !targetEnvId ||
              precheckQuery.isLoading ||
              !selectedCount ||
              mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {zh
              ? `复制 ${selectedCount} 个`
              : `Copy ${selectedCount} ${selectedCount === 1 ? "flag" : "flags"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
