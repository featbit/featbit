import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DialogShell({
  open,
  title,
  description,
  children,
  className,
  onClose,
}: {
  open: boolean
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
  onClose: () => void
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(calc(100vw-2rem),560px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-md border bg-background text-foreground shadow-lg outline-none",
            className
          )}
        >
          <header className="border-b px-6 py-5 pr-12">
            <Dialog.Title className="truncate text-base font-semibold tracking-normal">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : null}
            <Dialog.Close
              render={(props) => (
                <Button
                  {...props}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3"
                >
                  <X className="size-4" />
                </Button>
              )}
            />
          </header>
          <div className="overflow-y-auto">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function DrawerShell({
  open,
  title,
  description,
  children,
  wide,
  onClose,
}: {
  open: boolean
  title: string
  description?: ReactNode
  children: ReactNode
  wide?: boolean
  onClose: () => void
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(100vw,540px)] flex-col border-l bg-background text-foreground shadow-lg outline-none",
            wide && "w-[min(100vw,960px)]"
          )}
        >
          <header className="border-b px-6 py-5 pr-12">
            <Dialog.Title className="truncate text-base font-semibold tracking-normal">
              {title}
            </Dialog.Title>
            {description ? (
              <Dialog.Description
                render={(props) => (
                  <div
                    {...props}
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    {description}
                  </div>
                )}
              />
            ) : null}
            <Dialog.Close
              render={(props) => (
                <Button
                  {...props}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3"
                >
                  <X className="size-4" />
                </Button>
              )}
            />
          </header>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
