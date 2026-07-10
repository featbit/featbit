import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { localizedPath, resolveLang } from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import {
  addTeamMember,
  fetchGroupOptions,
  fetchPolicyOptions,
  fetchTeamMembers,
  memberResourceName,
  removeMemberFromOrganization,
  removeMemberFromWorkspace,
  type GroupOption,
  type PolicyOption,
  type TeamMember,
} from "./team-api"

type RemoveTarget = {
  member: TeamMember
  scope: "organization" | "workspace"
} | null

const pageSizeOptions = [10, 20, 30]

export function TeamPage() {
  const params = useParams()
  const lang = resolveLang(params.lang)
  const profile = useMemo(() => getStoredUserProfile(), [])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState<{ totalCount: number; items: TeamMember[] }>(
    { totalCount: 0, items: [] }
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(1)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [search])

  const loadMembers = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchTeamMembers({
      searchText: debouncedSearch,
      pageIndex: pageIndex - 1,
      pageSize,
    })
      .then(setData)
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to load team members"
        )
      )
      .finally(() => setIsLoading(false))
  }, [debouncedSearch, pageIndex, pageSize])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value)
    toast.success("Copied")
  }

  async function confirmRemove() {
    if (!removeTarget) {
      return
    }

    setIsRemoving(true)
    try {
      if (removeTarget.scope === "organization") {
        await removeMemberFromOrganization(removeTarget.member.id)
      } else {
        await removeMemberFromWorkspace(removeTarget.member.id)
      }
      setData((current) => ({
        totalCount: Math.max(0, current.totalCount - 1),
        items: current.items.filter(
          (item) => item.id !== removeTarget.member.id
        ),
      }))
      toast.success("Operation succeeded")
      setRemoveTarget(null)
    } catch {
      toast.error("Operation failed")
    } finally {
      setIsRemoving(false)
    }
  }

  const columns = useMemo<ColumnDef<TeamMember>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <EmailResourceCell
            member={row.original}
            onCopy={() => copyText(memberResourceName(row.original))}
          />
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            to={localizedPath(
              lang,
              `/iam/team/${encodeURIComponent(row.original.id)}/groups`
            )}
            className={cn(
              "font-semibold text-foreground hover:underline",
              !row.original.name && "text-muted-foreground"
            )}
          >
            {row.original.name || "No name"}
          </Link>
        ),
      },
      {
        id: "groups",
        header: "Groups",
        cell: ({ row }) => <GroupsCell groups={row.original.groups ?? []} />,
      },
      {
        accessorKey: "initialPassword",
        header: "Initial password",
        cell: ({ row }) =>
          row.original.initialPassword ? (
            <CopyCell
              value={row.original.initialPassword}
              label="Copy password"
              onCopy={() => copyText(row.original.initialPassword!)}
            />
          ) : (
            <span className="text-muted-foreground">******</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const isCurrentUser = profile.email === row.original.email
          return (
            <div className="flex items-center gap-3">
              <Link
                to={localizedPath(
                  lang,
                  `/iam/team/${encodeURIComponent(row.original.id)}/groups`
                )}
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "h-auto p-0 font-semibold no-underline hover:underline"
                )}
              >
                Details
              </Link>
              <RowActions
                disabled={isCurrentUser}
                onRemoveFromOrg={() =>
                  setRemoveTarget({
                    member: row.original,
                    scope: "organization",
                  })
                }
                onRemoveFromWorkspace={() =>
                  setRemoveTarget({ member: row.original, scope: "workspace" })
                }
              />
            </div>
          )
        },
      },
    ],
    [lang, profile.email]
  )

  const table = useReactTable({
    data: data.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  return (
    <TooltipProvider>
      <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-background px-8 py-6">
        <header className="mb-10 space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage organization members and their effective access.
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder="Filter by email"
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add member
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {error ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              Failed to load team members
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMembers}
              >
                Retry
              </Button>
            </div>
          ) : null}
          <TeamTable
            table={table}
            columnsCount={columns.length}
            isLoading={isLoading}
            hasSearch={Boolean(debouncedSearch)}
            onClearSearch={() => setSearch("")}
            onAddMember={() => setAddOpen(true)}
          />
        </div>

        <Pagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={data.totalCount}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize)
            setPageIndex(1)
          }}
        />

        {addOpen ? (
          <AddMemberSheet
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={() => {
              setAddOpen(false)
              loadMembers()
            }}
          />
        ) : null}

        <RemoveMemberDialog
          target={removeTarget}
          saving={isRemoving}
          onOpenChange={(open) => {
            if (!open) {
              setRemoveTarget(null)
            }
          }}
          onConfirm={confirmRemove}
        />
      </div>
    </TooltipProvider>
  )
}

function EmailResourceCell({
  member,
  onCopy,
}: {
  member: TeamMember
  onCopy: () => void
}) {
  const resourceName = memberResourceName(member)

  return (
    <div className="min-w-0 space-y-1">
      <Tooltip>
        <TooltipTrigger
          render={<span className="block truncate text-foreground" />}
        >
          {member.email || "-"}
        </TooltipTrigger>
        {member.email ? <TooltipContent>{member.email}</TooltipContent> : null}
      </Tooltip>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 shrink-0 text-muted-foreground"
                onClick={onCopy}
              />
            }
          >
            <Copy className="size-3" />
          </TooltipTrigger>
          <TooltipContent>Copy RN</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
            }
          >
            {resourceName}
          </TooltipTrigger>
          <TooltipContent>{resourceName}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function CopyCell({
  value,
  label,
  onCopy,
}: {
  value: string
  label: string
  onCopy: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={onCopy}
            />
          }
        >
          <Copy className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="block min-w-0 truncate font-mono text-xs text-foreground" />
          }
        >
          {value}
        </TooltipTrigger>
        <TooltipContent>{value}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function GroupsCell({ groups }: { groups: TeamMember["groups"] }) {
  if (!groups.length) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {groups.map((group) => (
        <Tooltip key={group.id}>
          <TooltipTrigger
            render={
              <Badge
                variant="outline"
                className="max-w-44 justify-start rounded-full px-2 font-normal"
              >
                <span className="min-w-0 truncate text-left">{group.name}</span>
              </Badge>
            }
          ></TooltipTrigger>
          <TooltipContent>{group.name}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function RowActions({
  disabled,
  onRemoveFromOrg,
  onRemoveFromWorkspace,
}: {
  disabled: boolean
  onRemoveFromOrg: () => void
  onRemoveFromWorkspace: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="icon-sm">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        {disabled ? (
          <DropdownMenuItem disabled>
            You cannot remove yourself.
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={onRemoveFromOrg}
            >
              Remove from organization
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={onRemoveFromWorkspace}
            >
              Remove from workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TeamTable({
  table,
  columnsCount,
  isLoading,
  hasSearch,
  onClearSearch,
  onAddMember,
}: {
  table: ReturnType<typeof useReactTable<TeamMember>>
  columnsCount: number
  isLoading: boolean
  hasSearch: boolean
  onClearSearch: () => void
  onAddMember: () => void
}) {
  return (
    <Table className="min-w-[920px] table-fixed">
      <TableHeader className="border-b text-left text-foreground">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className="px-5 py-4 font-semibold">
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TeamTableSkeleton columns={columnsCount} />
        ) : table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columnsCount} className="p-0">
              <StatusMessage
                title={
                  hasSearch
                    ? "No members match this email"
                    : "No team members yet"
                }
                action={
                  hasSearch ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClearSearch}
                    >
                      Clear search
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onAddMember}
                    >
                      Add member
                    </Button>
                  )
                }
              />
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className="px-5 py-4 align-middle text-sm text-foreground"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function TeamTableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="px-5 py-5">
              <Skeleton className="h-4 w-3/4" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

function StatusMessage({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {action}
    </div>
  )
}

function Pagination({
  pageIndex,
  pageSize,
  totalCount,
  onPageIndexChange,
  onPageSizeChange,
}: {
  pageIndex: number
  pageSize: number
  totalCount: number
  onPageIndexChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const first = totalCount === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const last = Math.min(totalCount, pageIndex * pageSize)
  const pages = Array.from(
    new Set([1, pageIndex - 1, pageIndex, pageIndex + 1, totalPages])
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>
        Showing {first} to {last} of {totalCount} members
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pageIndex <= 1}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((page, index) => {
          const previous = pages[index - 1]
          return (
            <span key={page} className="flex items-center gap-2">
              {previous && page - previous > 1 ? (
                <span className="px-2 text-foreground">...</span>
              ) : null}
              <Button
                type="button"
                variant={page === pageIndex ? "outline" : "ghost"}
                size="icon"
                className={cn(
                  page === pageIndex && "border-primary text-primary"
                )}
                onClick={() => onPageIndexChange(page)}
              >
                {page}
              </Button>
            </span>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pageIndex >= totalPages}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="ml-0 min-w-28 justify-between md:ml-4"
              >
                {pageSize} / page
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {pageSizeOptions.map((option) => (
              <DropdownMenuItem
                key={option}
                className="cursor-pointer"
                onClick={() => onPageSizeChange(option)}
              >
                {option} / page
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function AddMemberSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const [email, setEmail] = useState("")
  const [policies, setPolicies] = useState<PolicyOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError(null)
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email.")
      return
    }
    if (policies.length === 0 && groups.length === 0) {
      setError("Select at least one policy or group.")
      return
    }

    setSaving(true)
    try {
      await addTeamMember({
        email: email.trim(),
        policyIds: policies.map((policy) => policy.id),
        groupIds: groups.map((group) => group.id),
      })
      toast.success("Operation succeeded")
      onAdded()
    } catch {
      toast.error("Operation failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]">
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>Add team member</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="team-member-email">Email</Label>
            <Input
              id="team-member-email"
              value={email}
              placeholder="new.user@acme.io"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-5">
              <h3 className="text-sm font-semibold text-foreground">
                Permissions
              </h3>
              <p className="text-xs text-muted-foreground">
                Select at least one policy or group.
              </p>
            </div>

            <PermissionMultiPicker
              label="Policy"
              selectedLabel="Selected policies"
              placeholder="Search policies"
              selected={policies}
              onSelectedChange={setPolicies}
              getOptionMeta={(item) =>
                item.type === "SysManaged" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="size-3" />
                    System
                  </span>
                ) : null
              }
              loadOptions={loadPolicyOptions}
            />

            <PermissionMultiPicker
              label="Group"
              selectedLabel="Selected groups"
              placeholder="Search groups"
              selected={groups}
              onSelectedChange={setGroups}
              loadOptions={loadGroupOptions}
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </section>
        </div>

        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" disabled={saving} onClick={submit}>
            {saving ? "Adding..." : "Add member"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const loadPolicyOptions = (query: string) =>
  fetchPolicyOptions({ name: query }).then((result) => result.items)

const loadGroupOptions = (query: string) =>
  fetchGroupOptions({ name: query }).then((result) => result.items)

function PermissionMultiPicker<TOption extends { id: string; name: string }>({
  label,
  selectedLabel,
  placeholder,
  selected,
  onSelectedChange,
  loadOptions,
  getOptionMeta,
}: {
  label: string
  selectedLabel: string
  placeholder: string
  selected: TOption[]
  onSelectedChange: (options: TOption[]) => void
  loadOptions: (query: string) => Promise<TOption[]>
  getOptionMeta?: (option: TOption) => ReactNode
}) {
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<TOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoading(true)
      loadOptions(query)
        .then((items) => {
          if (!cancelled) {
            setOptions(items)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOptions([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [loadOptions, query])

  const mergedOptions = useMemo(() => {
    const next = new Map<string, TOption>()
    selected.forEach((option) => next.set(option.id, option))
    options.forEach((option) => next.set(option.id, option))
    return Array.from(next.values())
  }, [options, selected])

  function toggleOption(option: TOption) {
    const exists = selected.some(
      (selectedOption) => selectedOption.id === option.id
    )

    if (exists) {
      onSelectedChange(
        selected.filter((selectedOption) => selectedOption.id !== option.id)
      )
      return
    }

    onSelectedChange([...selected, option])
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">
          {selected.length} selected
        </span>
      </div>

      <Command shouldFilter={false} className="rounded-none p-0">
        <CommandInput
          value={query}
          placeholder={placeholder}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-40 border-t">
          {loading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-4/5" />
            </div>
          ) : (
            <>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {mergedOptions.map((option) => {
                  const isSelected = selected.some(
                    (selectedOption) => selectedOption.id === option.id
                  )

                  return (
                    <CommandItem
                      key={option.id}
                      value={`${option.name} ${option.id}`}
                      data-checked={isSelected}
                      onSelect={() => toggleOption(option)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {option.name}
                      </span>
                      {getOptionMeta?.(option)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>

      <div className="space-y-2 border-t bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-foreground">
            {selectedLabel}
          </span>
          {selected.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onSelectedChange([])}
            >
              Clear all
            </Button>
          ) : null}
        </div>
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((option) => (
              <Badge
                key={option.id}
                variant="secondary"
                className="max-w-full gap-1 rounded-full py-0.5 pr-1 pl-2 font-normal"
              >
                <span className="min-w-0 truncate">{option.name}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() =>
                    onSelectedChange(
                      selected.filter(
                        (selectedOption) => selectedOption.id !== option.id
                      )
                    )
                  }
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No {label.toLowerCase()} selected.
          </p>
        )}
      </div>
    </div>
  )
}

function RemoveMemberDialog({
  target,
  saving,
  onOpenChange,
  onConfirm,
}: {
  target: RemoveTarget
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const isWorkspace = target?.scope === "workspace"

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isWorkspace ? "Remove from workspace" : "Remove from organization"}
          </DialogTitle>
          <DialogDescription>
            {isWorkspace
              ? "This operation will remove the user from the workspace and all related organizations."
              : "This operation will remove the user from the current organization."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? "Removing..." : "Remove"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
