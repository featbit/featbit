import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  createSegmentEndUser,
  searchSegmentUsers,
} from "@/features/segments/segments-api"
import type { SegmentEndUser } from "@/features/segments/segments-types"

function userLabel(user: SegmentEndUser) {
  return user.name?.trim() || user.keyId
}

function userOptionValue(user: SegmentEndUser) {
  return `${user.envId ?? "global"}:${user.id}:${user.keyId}`
}

function GlobalUserBadge() {
  const { t } = useTranslation()

  return (
    <Badge
      variant="outline"
      className="h-5 shrink-0 px-1.5 text-[10px] font-normal"
    >
      {t("targeting.users.globalUser")}
    </Badge>
  )
}

export function UserPicker({
  envId,
  shared,
  selected,
  excluded,
  disabled,
  onAdd,
}: {
  envId: string
  shared: boolean
  selected: string[]
  excluded: string[]
  disabled: boolean
  onAdd: (user: SegmentEndUser) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const query = useQuery({
    queryKey: ["segment-user-search", envId, shared, debounced, excluded],
    queryFn: () =>
      searchSegmentUsers(envId, {
        searchText: debounced,
        excludedKeyIds: excluded,
        globalUserOnly: shared,
      }),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: (keyId: string) => createSegmentEndUser(envId, keyId),
    onSuccess: (user) => {
      onAdd(user)
      setOpen(false)
      setSearch("")
      void queryClient.invalidateQueries({
        queryKey: ["segment-user-search", envId],
      })
      void queryClient.invalidateQueries({ queryKey: ["end-users", envId] })
    },
    onError: () => toast.error(t("targeting.users.createFailed")),
  })

  const keyId = search.trim()
  const canCreate =
    !shared &&
    Boolean(keyId) &&
    query.isSuccess &&
    debounced === keyId &&
    !excluded.includes(keyId) &&
    !(query.data ?? []).some((user) => user.keyId === keyId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 w-full justify-start font-normal text-muted-foreground"
          />
        }
      >
        <Search className="size-4" />
        {t("targeting.users.search")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            placeholder={t("targeting.users.search")}
            onValueChange={setSearch}
          />
          <CommandList>
            {query.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("targeting.loading")}
              </div>
            ) : query.isError ? (
              <div className="flex items-center justify-between px-3 py-4 text-sm text-destructive">
                {t("targeting.users.loadFailed")}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void query.refetch()}
                >
                  {t("targeting.retry")}
                </Button>
              </div>
            ) : null}
            <CommandEmpty>
              {shared && keyId
                ? t("targeting.users.sharedOnly")
                : t("targeting.users.noUsers")}
            </CommandEmpty>
            <CommandGroup>
              {canCreate ? (
                <CommandItem
                  value={`create-${keyId}`}
                  disabled={createMutation.isPending}
                  onSelect={() => createMutation.mutate(keyId)}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  <span className="truncate">
                    {createMutation.isPending
                      ? t("targeting.users.creating")
                      : t("targeting.users.create", {
                          keyId,
                        })}
                  </span>
                </CommandItem>
              ) : null}
              {(query.data ?? [])
                .filter((user) => !selected.includes(user.keyId))
                .map((user) => (
                  <CommandItem
                    key={`${user.envId ?? "global"}-${user.keyId}`}
                    value={userOptionValue(user)}
                    onSelect={() => {
                      onAdd(user)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {userLabel(user)}
                        </p>
                        {user.envId === null ? <GlobalUserBadge /> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.keyId}
                      </p>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function UserPanel({
  title,
  envId,
  shared,
  keys,
  users,
  otherKeys,
  disabled,
  onChange,
  onResolved,
}: {
  title: string
  envId: string
  shared: boolean
  keys: string[]
  users: Map<string, SegmentEndUser>
  otherKeys: string[]
  disabled: boolean
  onChange: (keys: string[]) => void
  onResolved: (user: SegmentEndUser) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="min-w-0 rounded-md border p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {keys.length ? (
          <span className="text-xs text-muted-foreground">· {keys.length}</span>
        ) : null}
      </div>
      <UserPicker
        envId={envId}
        shared={shared}
        selected={keys}
        excluded={[...keys, ...otherKeys]}
        disabled={disabled}
        onAdd={(user) => {
          onResolved(user)
          onChange([...keys, user.keyId])
        }}
      />
      <div className="mt-2 max-h-44 overflow-y-auto pr-1">
        {keys.length ? (
          keys.map((key) => {
            const user = users.get(key)
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 border-b px-2 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {user ? userLabel(user) : key}
                    </p>
                    {user?.envId === null ? <GlobalUserBadge /> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.keyId ?? key}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={t("targeting.users.remove", {
                    user: user ? userLabel(user) : key,
                  })}
                  onClick={() =>
                    onChange(keys.filter((value) => value !== key))
                  }
                >
                  <X />
                </Button>
              </div>
            )
          })
        ) : (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {t("targeting.users.empty")}
          </p>
        )}
      </div>
    </section>
  )
}
