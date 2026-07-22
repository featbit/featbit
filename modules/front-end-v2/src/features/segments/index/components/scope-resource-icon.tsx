import { Box, Building2, Folder, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ScopeResource } from "../segments-types"

const scopeResourceIcons: Record<ScopeResource["type"], LucideIcon> = {
  organization: Building2,
  project: Folder,
  env: Box,
}

export function ScopeResourceIcon({
  type,
  className,
}: {
  type: ScopeResource["type"]
  className?: string
}) {
  const Icon = scopeResourceIcons[type]
  return (
    <Icon
      aria-hidden
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  )
}
