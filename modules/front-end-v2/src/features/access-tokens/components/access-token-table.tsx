import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { localizedPath } from "@/features/layout/layout-context"
import type { Lang } from "@/features/layout/layout-types"
import { cn } from "@/lib/utils"
import type { AccessToken } from "../access-token-types"

function CreatorCell({ token, lang }: { token: AccessToken; lang: Lang }) {
  const creator = token.creator
  const name = creator?.name?.trim()
  const email = creator?.email?.trim()

  if (!name && !email) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
      {name && creator?.id ? (
        <Link
          to={localizedPath(
            lang,
            `/iam/team/${encodeURIComponent(creator.id)}/permissions`
          )}
          className="block w-fit max-w-full truncate font-medium text-foreground underline-offset-4 hover:underline"
        >
          {name}
        </Link>
      ) : (
        <span className="block truncate font-medium text-foreground">
          {name || "-"}
        </span>
      )}
      {email ? (
        <span className="block truncate text-xs text-muted-foreground">
          {email}
        </span>
      ) : null}
    </div>
  )
}

function formatLastUsed(value: string | null | undefined, lang: Lang) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function RowActions({
  token,
  manageable,
  mutating,
  onEdit,
  onView,
  onActivate,
  onDeactivate,
  onRemove,
}: {
  token: AccessToken
  manageable: boolean
  mutating: boolean
  onEdit: (token: AccessToken) => void
  onView: (token: AccessToken) => void
  onActivate: (token: AccessToken) => void
  onDeactivate: (token: AccessToken) => void
  onRemove: (token: AccessToken) => void
}) {
  const { t } = useTranslation()

  if (!manageable) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="font-medium text-primary hover:text-primary"
        onClick={() => onView(token)}
      >
        {t("accessTokens.actions.view")}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("accessTokens.actions.menu", { name: token.name })}
            disabled={mutating}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem onClick={() => onEdit(token)}>
          {t("accessTokens.actions.edit")}
        </DropdownMenuItem>
        {token.status === "Inactive" ? (
          <DropdownMenuItem onClick={() => onActivate(token)}>
            {t("accessTokens.actions.activate")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onDeactivate(token)}>
            {t("accessTokens.actions.deactivate")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onRemove(token)}
        >
          {t("accessTokens.actions.remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AccessTokenTable({
  data,
  lang,
  loading,
  emptyMessage,
  emptyAction,
  isManageable,
  mutatingId,
  onEdit,
  onView,
  onActivate,
  onDeactivate,
  onRemove,
}: {
  data: AccessToken[]
  lang: Lang
  loading: boolean
  emptyMessage: string
  emptyAction?: { label: string; onClick: () => void }
  isManageable: (token: AccessToken) => boolean
  mutatingId: string | null
  onEdit: (token: AccessToken) => void
  onView: (token: AccessToken) => void
  onActivate: (token: AccessToken) => void
  onDeactivate: (token: AccessToken) => void
  onRemove: (token: AccessToken) => void
}) {
  const { t } = useTranslation()
  const columns = useMemo<ColumnDef<AccessToken>[]>(
    () => [
      {
        accessorKey: "name",
        size: 220,
        header: t("accessTokens.columns.name"),
        cell: ({ row }) => (
          <span
            className="block truncate font-medium text-foreground"
            title={row.original.name}
          >
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "type",
        size: 105,
        header: t("accessTokens.columns.type"),
        cell: ({ row }) =>
          t(`accessTokens.types.${row.original.type}`, {
            defaultValue: row.original.type,
          }),
      },
      {
        id: "creator",
        size: 200,
        header: t("accessTokens.columns.createdBy"),
        cell: ({ row }) => <CreatorCell token={row.original} lang={lang} />,
      },
      {
        accessorKey: "status",
        size: 120,
        header: t("accessTokens.columns.status"),
        cell: ({ row }) => {
          const status = row.original.status
          if (!status) return "-"

          return (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  status === "Active"
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/50"
                )}
                aria-hidden="true"
              />
              {t(`accessTokens.statuses.${status}`, { defaultValue: status })}
            </span>
          )
        },
      },
      {
        accessorKey: "lastUsedAt",
        size: 180,
        header: t("accessTokens.columns.lastUsed"),
        cell: ({ row }) => formatLastUsed(row.original.lastUsedAt, lang),
      },
      {
        accessorKey: "token",
        size: 230,
        header: t("accessTokens.columns.token"),
        cell: ({ row }) => (
          <span
            className="block truncate font-mono text-xs text-muted-foreground"
            title={row.original.token || undefined}
          >
            {row.original.token || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        size: 90,
        header: () => (
          <span className="block text-right">
            {t("accessTokens.columns.actions")}
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowActions
              token={row.original}
              manageable={isManageable(row.original)}
              mutating={mutatingId === row.original.id}
              onEdit={onEdit}
              onView={onView}
              onActivate={onActivate}
              onDeactivate={onDeactivate}
              onRemove={onRemove}
            />
          </div>
        ),
      },
    ],
    [
      isManageable,
      lang,
      mutatingId,
      onActivate,
      onDeactivate,
      onEdit,
      onRemove,
      onView,
      t,
    ]
  )

  // TanStack Table intentionally returns a mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  return (
    <div className="overflow-x-auto rounded-md border bg-background">
      <Table className="min-w-[1120px] table-fixed">
        <TableHeader className="bg-muted/30">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-11 px-4 font-semibold text-foreground"
                  style={{ width: header.getSize() }}
                >
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
          {loading ? (
            <TableSkeleton columns={columns.length} />
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.original.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="h-12 px-4 py-2.5 align-middle text-sm"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="p-0">
                <div className="flex min-h-52 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {emptyMessage}
                  </p>
                  {emptyAction ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={emptyAction.onClick}
                    >
                      {emptyAction.label}
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="h-12 px-4 py-2.5">
              <Skeleton className="h-4 w-3/4" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
