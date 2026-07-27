import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Fragment, useState, type ReactNode } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChangeLedger, type ChangeLedgerProps } from "./change-ledger"
import type {
  ChangeLedgerLayout,
  ChangeReviewItem,
} from "./change-review-types"

function ReviewSaveOptionsContent({
  children,
  side = "top",
}: {
  children: ReactNode
  side?: "top" | "bottom"
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align="end"
        side={side}
        sideOffset={4}
        className="z-[60]"
        data-slot="review-save-options-positioner"
      >
        <MenuPrimitive.Popup className="w-64 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

export type ReviewSaveOption = {
  label: string
  description?: string
  icon?: ReactNode
  current?: boolean
  disabled?: boolean
  onSelect: () => void
}

export function ReviewSaveSplitButton({
  primaryLabel,
  savingLabel,
  saving,
  primaryDisabled,
  menuLabel,
  menuSide = "top",
  separateAfterFirst = true,
  options,
  onPrimary,
}: {
  primaryLabel: string
  savingLabel: string
  saving: boolean
  primaryDisabled: boolean
  menuLabel: string
  menuSide?: "top" | "bottom"
  separateAfterFirst?: boolean
  options: ReviewSaveOption[]
  onPrimary: () => void
}) {
  return (
    <div data-slot="review-save-split" className="inline-flex">
      <Button
        type="button"
        className="rounded-r-none border-r-0"
        disabled={saving || primaryDisabled}
        onClick={onPrimary}
      >
        {saving ? savingLabel : primaryLabel}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon"
              className="rounded-l-none border-l border-primary-foreground/20"
              disabled={saving}
              aria-label={menuLabel}
            />
          }
        >
          <ChevronDown />
        </DropdownMenuTrigger>
        <ReviewSaveOptionsContent side={menuSide}>
          {options.map((option, index) => (
            <Fragment key={option.label}>
              {separateAfterFirst && index === 1 ? (
                <DropdownMenuSeparator />
              ) : null}
              <DropdownMenuItem
                className="cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0"
                disabled={option.disabled}
                onClick={option.onSelect}
              >
                {option.current ? <Check /> : option.icon}
                <div>
                  <div>{option.label}</div>
                  {option.description ? (
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  ) : null}
                </div>
              </DropdownMenuItem>
            </Fragment>
          ))}
        </ReviewSaveOptionsContent>
      </DropdownMenu>
    </div>
  )
}

export type ChangeReviewDialogCopy = {
  title: string
  description: string
  changes: string
  changeCount: (count: number) => string
  comment: string
  optional: string
  commentPlaceholder: string
  commentHelp: string
  cancel: string
  save: string
  saving: string
}

type Props<TChange extends ChangeReviewItem> = {
  open: boolean
  idPrefix: string
  layout: Exclude<ChangeLedgerLayout, "history">
  changes: TChange[]
  requireComment: boolean
  saving: boolean
  initialComment?: string
  copy: ChangeReviewDialogCopy
  ledger: Omit<ChangeLedgerProps<TChange>, "changes" | "layout">
  saveOptions?: Array<{
    label: string
    icon?: ReactNode
    onSelect: (comment: string) => void
  }>
  saveOptionsLabel?: string
  saveImmediatelyDescription?: string
  onOpenChange: (open: boolean) => void
  onSave: (comment: string) => void
}

export function ChangeReviewDialog<TChange extends ChangeReviewItem>({
  open,
  idPrefix,
  layout,
  changes,
  requireComment,
  saving,
  initialComment,
  copy,
  ledger,
  saveOptions,
  saveOptionsLabel,
  saveImmediatelyDescription,
  onOpenChange,
  onSave,
}: Props<TChange>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ReviewDialogContent
          idPrefix={idPrefix}
          layout={layout}
          changes={changes}
          requireComment={requireComment}
          saving={saving}
          initialComment={initialComment}
          copy={copy}
          ledger={ledger}
          saveOptions={saveOptions}
          saveOptionsLabel={saveOptionsLabel}
          saveImmediatelyDescription={saveImmediatelyDescription}
          onClose={() => onOpenChange(false)}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  )
}

function ReviewDialogContent<TChange extends ChangeReviewItem>({
  idPrefix,
  layout,
  changes,
  requireComment,
  saving,
  initialComment,
  copy,
  ledger,
  saveOptions,
  saveOptionsLabel,
  saveImmediatelyDescription,
  onClose,
  onSave,
}: Omit<Props<TChange>, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [comment, setComment] = useState(initialComment ?? "")

  return (
    <>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-medium">{copy.changes}</h3>
            <span className="text-sm text-muted-foreground">
              {copy.changeCount(changes.length)}
            </span>
          </div>
          <ChangeLedger changes={changes} layout={layout} {...ledger} />
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-change-comment`}>
              {copy.comment}
              {requireComment ? (
                <span className="ml-0.5 text-destructive">*</span>
              ) : (
                <span className="font-normal text-muted-foreground">
                  {` ${copy.optional}`}
                </span>
              )}
            </Label>
            <Textarea
              id={`${idPrefix}-change-comment`}
              value={comment}
              rows={3}
              placeholder={copy.commentPlaceholder}
              onChange={(event) => setComment(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{copy.commentHelp}</p>
          </div>
        </div>
        <DialogFooter className="border-t-0 bg-transparent">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            {copy.cancel}
          </Button>
          {saveOptions?.length ? (
            <ReviewSaveSplitButton
              primaryLabel={copy.save}
              savingLabel={copy.saving}
              saving={saving}
              primaryDisabled={Boolean(requireComment && !comment.trim())}
              menuLabel={saveOptionsLabel ?? copy.save}
              options={[
                {
                  label: copy.save,
                  description: saveImmediatelyDescription,
                  current: true,
                  disabled: Boolean(requireComment && !comment.trim()),
                  onSelect: () => onSave(comment.trim()),
                },
                ...saveOptions.map((option) => ({
                  ...option,
                  onSelect: () => option.onSelect(comment.trim()),
                })),
              ]}
              onPrimary={() => onSave(comment.trim())}
            />
          ) : (
            <Button
              type="button"
              disabled={saving || (requireComment && !comment.trim())}
              onClick={() => onSave(comment.trim())}
            >
              {saving ? copy.saving : copy.save}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </>
  )
}
