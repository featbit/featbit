import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import type { ReactNode, RefObject } from "react"
import { cn } from "@/lib/utils"

export function StablePopoverContent({
  children,
  className,
  portalContainer,
  align = "center",
  side = "bottom",
  sideOffset = 4,
}: {
  children: ReactNode
  className?: string
  portalContainer?: RefObject<HTMLElement | null>
  align?: PopoverPrimitive.Positioner.Props["align"]
  side?: PopoverPrimitive.Positioner.Props["side"]
  sideOffset?: PopoverPrimitive.Positioner.Props["sideOffset"]
}) {
  return (
    <PopoverPrimitive.Portal container={portalContainer}>
      <PopoverPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="pointer-events-none flex h-[calc(clamp(10rem,40dvh,18rem)+8rem)] flex-col justify-start data-[side=top]:justify-end"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "pointer-events-auto z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none [&>[data-slot=command]]:h-auto!",
            className
          )}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
