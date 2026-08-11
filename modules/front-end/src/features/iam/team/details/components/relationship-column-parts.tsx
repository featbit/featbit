import { Copy, Star } from "lucide-react"
import { Link } from "react-router-dom"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function ResourceLine({
  value,
  copyLabel,
  onCopy,
}: {
  value: string
  copyLabel: string
  onCopy: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5 shrink-0 text-muted-foreground"
              aria-label={copyLabel}
              onClick={onCopy}
            />
          }
        >
          <Copy className="size-3" />
        </TooltipTrigger>
        <TooltipContent>{copyLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="block min-w-0 truncate font-mono text-[0.72rem]" />
          }
        >
          {value}
        </TooltipTrigger>
        <TooltipContent>{value}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function DescriptionCell({ description }: { description?: string }) {
  const value = description || "-"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="block min-w-0 truncate text-muted-foreground" />
        }
      >
        {value}
      </TooltipTrigger>
      {description ? (
        <TooltipContent className="max-w-80">{description}</TooltipContent>
      ) : null}
    </Tooltip>
  )
}

export function PolicyTypeCell({
  type,
  systemManagedLabel,
  customerManagedLabel,
}: {
  type: string
  systemManagedLabel: string
  customerManagedLabel: string
}) {
  const label =
    type === "SysManaged"
      ? systemManagedLabel
      : type === "CustomerManaged"
        ? customerManagedLabel
        : "-"

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {type === "SysManaged" ? (
        <Star className="size-3.5 text-muted-foreground" />
      ) : null}
      {label}
    </span>
  )
}

export function RowActions({
  detailsHref,
  detailsLabel,
  removeLabel,
  onRemove,
}: {
  detailsHref: string
  detailsLabel: string
  removeLabel: string
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <DetailsLink href={detailsHref} label={detailsLabel} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={onRemove}
      >
        {removeLabel}
      </Button>
    </div>
  )
}

export function DetailsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      to={href}
      target="_blank"
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "font-medium whitespace-nowrap"
      )}
    >
      {label}
    </Link>
  )
}
