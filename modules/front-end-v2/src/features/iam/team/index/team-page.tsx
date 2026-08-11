import { Plus, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getStoredUserProfile } from "@/features/auth/auth-api"
import {
  getCurrentOrganization,
  localizedPath,
  resolveLang,
} from "@/features/layout/layout-context"
import { cn } from "@/lib/utils"
import { AddMemberSheet } from "./components/add-member-sheet"
import {
  RemoveMemberDialog,
  type RemoveTarget,
} from "./components/remove-member-dialog"
import {
  CopyCell,
  EmailResourceCell,
  GroupsCell,
  RowActions,
  TeamTable,
} from "./components/team-table"
import { TeamPagination } from "./components/team-pagination"
import {
  memberResourceName,
  removeMemberFromOrganization,
  removeMemberFromWorkspace,
  teamMembersQueryOptions,
  teamQueryKeys,
  type PagedResult,
  type TeamMember,
} from "../team-api"

export function TeamPage() {
  const { t } = useTranslation()
  const params = useParams()
  const lang = resolveLang(params.lang)
  const queryClient = useQueryClient()
  const profile = useMemo(() => getStoredUserProfile(), [])
  const organizationId = getCurrentOrganization()?.id ?? ""
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  const memberParams = useMemo(
    () => ({
      searchText: debouncedSearch,
      pageIndex: pageIndex - 1,
      pageSize,
    }),
    [debouncedSearch, pageIndex, pageSize]
  )
  const membersQuery = useQuery({
    ...teamMembersQueryOptions(organizationId, memberParams),
    enabled: Boolean(organizationId),
  })
  const data = membersQuery.data ?? { totalCount: 0, items: [] }

  const copyText = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value)
      toast.success(t("iam.team.copied"))
    },
    [t]
  )

  async function confirmRemove() {
    if (!removeTarget) return

    setIsRemoving(true)
    try {
      if (removeTarget.scope === "organization") {
        await removeMemberFromOrganization(removeTarget.member.id)
      } else {
        await removeMemberFromWorkspace(removeTarget.member.id)
      }
      queryClient.setQueryData<PagedResult<TeamMember>>(
        teamQueryKeys.members(organizationId, memberParams),
        (current) => ({
          totalCount: Math.max(0, (current?.totalCount ?? 0) - 1),
          items: (current?.items ?? []).filter(
            (item) => item.id !== removeTarget.member.id
          ),
        })
      )
      void queryClient.invalidateQueries({
        queryKey: teamQueryKeys.memberLists(organizationId),
      })
      toast.success(t("iam.team.operationSucceeded"))
      setRemoveTarget(null)
    } catch {
      toast.error(t("iam.team.operationFailed"))
    } finally {
      setIsRemoving(false)
    }
  }

  const columns = useMemo<ColumnDef<TeamMember>[]>(
    () => [
      {
        accessorKey: "email",
        header: t("iam.team.columns.email"),
        cell: ({ row }) => {
          const detailsPath = localizedPath(
            lang,
            `/iam/team/${encodeURIComponent(row.original.id)}/permissions`
          )

          return (
            <EmailResourceCell
              member={row.original}
              detailsPath={detailsPath}
              onCopy={() => copyText(memberResourceName(row.original))}
            />
          )
        },
      },
      {
        accessorKey: "name",
        header: t("iam.team.columns.name"),
        cell: ({ row }) => (
          <Link
            to={localizedPath(
              lang,
              `/iam/team/${encodeURIComponent(row.original.id)}/permissions`
            )}
            className={cn(
              "font-semibold text-foreground hover:underline",
              !row.original.name && "text-muted-foreground"
            )}
          >
            {row.original.name || t("iam.team.noName")}
          </Link>
        ),
      },
      {
        id: "groups",
        header: t("iam.team.columns.groups"),
        cell: ({ row }) => <GroupsCell groups={row.original.groups ?? []} />,
      },
      {
        accessorKey: "initialPassword",
        header: t("iam.team.columns.initialPassword"),
        cell: ({ row }) =>
          row.original.initialPassword ? (
            <CopyCell
              value={row.original.initialPassword}
              label={t("iam.team.copyPassword")}
              onCopy={() => copyText(row.original.initialPassword!)}
            />
          ) : (
            <span className="text-muted-foreground">******</span>
          ),
      },
      {
        id: "actions",
        header: t("iam.team.columns.actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Link
              to={localizedPath(
                lang,
                `/iam/team/${encodeURIComponent(row.original.id)}/permissions`
              )}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "font-medium"
              )}
            >
              {t("iam.team.viewDetails")}
            </Link>
            <RowActions
              disabled={profile.email === row.original.email}
              onRemoveFromOrg={() =>
                setRemoveTarget({ member: row.original, scope: "organization" })
              }
              onRemoveFromWorkspace={() =>
                setRemoveTarget({ member: row.original, scope: "workspace" })
              }
            />
          </div>
        ),
      },
    ],
    [copyText, lang, profile.email, t]
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
          <h1 className="text-2xl font-semibold tracking-normal">
            {t("iam.team.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("iam.team.subtitle")}
          </p>
        </header>

        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="relative w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder={t("iam.team.searchPlaceholder")}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {t("iam.team.addMember")}
          </Button>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          {membersQuery.isError ? (
            <div className="flex items-center justify-between border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">
              {t("iam.team.loadFailed")}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void membersQuery.refetch()}
              >
                {t("iam.team.retry")}
              </Button>
            </div>
          ) : null}
          <TeamTable
            table={table}
            columnsCount={columns.length}
            isLoading={membersQuery.isLoading}
            hasSearch={Boolean(debouncedSearch)}
            onClearSearch={() => setSearch("")}
            onAddMember={() => setAddOpen(true)}
          />
        </div>

        <TeamPagination
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
              void queryClient.invalidateQueries({
                queryKey: teamQueryKeys.memberLists(organizationId),
              })
            }}
          />
        ) : null}

        <RemoveMemberDialog
          target={removeTarget}
          saving={isRemoving}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null)
          }}
          onConfirm={confirmRemove}
        />
      </div>
    </TooltipProvider>
  )
}
