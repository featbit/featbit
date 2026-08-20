import { Info, LockKeyhole, Shield } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type LicenseGateContentProps = {
  title: string
  description: string
  actionLabel: string
  actionHref: string
  note: string
  className?: string
  dialogSemantics?: boolean
}

export function LicenseGateContent({
  title,
  description,
  actionLabel,
  actionHref,
  note,
  className,
  dialogSemantics = false,
}: LicenseGateContentProps) {
  return (
    <div
      className={cn(
        "flex max-w-xl flex-col items-center text-center",
        className
      )}
    >
      <div className="relative flex size-16 items-center justify-center rounded-xl border bg-muted/40 text-foreground">
        <Shield aria-hidden className="size-9 stroke-[1.5]" />
        <LockKeyhole
          aria-hidden
          className="absolute size-3.5 translate-y-0.5 stroke-[2.25]"
        />
      </div>

      {dialogSemantics ? (
        <DialogTitle className="mt-8 text-xl leading-normal font-semibold tracking-normal">
          {title}
        </DialogTitle>
      ) : (
        <h2 className="mt-8 text-xl font-semibold tracking-normal">{title}</h2>
      )}
      {dialogSemantics ? (
        <DialogDescription className="mt-3 max-w-[65ch] text-sm leading-6">
          {description}
        </DialogDescription>
      ) : (
        <p className="mt-3 max-w-[65ch] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}

      <Button
        nativeButton={false}
        className="mt-7 min-w-36"
        render={<Link to={actionHref} />}
      >
        {actionLabel}
      </Button>

      <p className="mt-6 flex items-start gap-2 text-left text-xs text-muted-foreground">
        <Info aria-hidden className="size-4 shrink-0" />
        <span>{note}</span>
      </p>
    </div>
  )
}

export function LicenseGateDialog({
  open,
  title,
  description,
  actionLabel,
  actionHref,
  note,
  closeLabel,
  onOpenChange,
}: LicenseGateContentProps & {
  open: boolean
  closeLabel: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex min-h-96 items-center justify-center px-8 py-12">
          <LicenseGateContent
            title={title}
            description={description}
            actionLabel={actionLabel}
            actionHref={actionHref}
            note={note}
            className="-translate-y-3"
            dialogSemantics
          />
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t-0 bg-transparent px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LicenseGateCard({
  title,
  description,
  actionLabel,
  actionHref,
  note,
}: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
  note: string
}) {
  return (
    <Card className="min-h-[clamp(30rem,66vh,39rem)] gap-0 bg-background py-0 shadow-none">
      <CardContent className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <LicenseGateContent
          title={title}
          description={description}
          actionLabel={actionLabel}
          actionHref={actionHref}
          note={note}
          className="-translate-y-8"
        />
      </CardContent>
    </Card>
  )
}
