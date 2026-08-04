import { ChevronDown, Copy } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { memberResourceName, type TeamMember } from "../../team-api"

export function EmailResourceCell({
  member,
  onCopy,
}: {
  member: TeamMember
  onCopy: () => void
}) {
  const { t } = useTranslation()
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
          <TooltipContent>{t("iam.team.copyResourceName")}</TooltipContent>
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

export function CopyCell({
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

export function GroupsCell({ groups }: { groups: TeamMember["groups"] }) {
  if (!groups.length) return <span className="text-muted-foreground">-</span>

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
          />
          <TooltipContent>{group.name}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

export function RowActions({
  disabled,
  onRemoveFromOrg,
  onRemoveFromWorkspace,
}: {
  disabled: boolean
  onRemoveFromOrg: () => void
  onRemoveFromWorkspace: () => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            {t("iam.team.manage.button")}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {disabled ? (
          <DropdownMenuItem disabled>
            {t("iam.team.manage.cannotRemoveSelf")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("iam.team.manage.heading")}
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={onRemoveFromOrg}
            >
              {t("iam.team.manage.organization")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={onRemoveFromWorkspace}
            >
              {t("iam.team.manage.workspace")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TeamTable({
  table,
  columnsCount,
  isLoading,
  hasSearch,
  onClearSearch,
  onAddMember,
}: {
  table: TanStackTable<TeamMember>
  columnsCount: number
  isLoading: boolean
  hasSearch: boolean
  onClearSearch: () => void
  onAddMember: () => void
}) {
  const { t } = useTranslation()
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
                    ? t("iam.team.noSearchResults")
                    : t("iam.team.empty")
                }
                action={
                  hasSearch ? (
                    <Button variant="outline" onClick={onClearSearch}>
                      {t("iam.team.clearSearch")}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={onAddMember}>
                      {t("iam.team.addMember")}
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
