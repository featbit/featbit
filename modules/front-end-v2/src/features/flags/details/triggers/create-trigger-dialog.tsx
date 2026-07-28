import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  CreateFlagTriggerInput,
  FlagTriggerAction,
  FlagTriggerType,
} from "./triggers-api"

export function CreateTriggerDialog({
  open,
  targetId,
  saving,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  targetId: string
  saving: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreateFlagTriggerInput) => void
}) {
  const { t } = useTranslation()
  const [type, setType] = useState<FlagTriggerType>("feature-flag-general")
  const [action, setAction] = useState<FlagTriggerAction>("turn-on")
  const [description, setDescription] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("featureFlags.detailsPage.triggers.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("featureFlags.detailsPage.triggers.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="trigger-type">
              {t("featureFlags.detailsPage.triggers.type")}
            </Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as FlagTriggerType)}
              disabled={saving}
            >
              <SelectTrigger id="trigger-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="feature-flag-general">
                    {t("featureFlags.detailsPage.triggers.general")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger-action">
              {t("featureFlags.detailsPage.triggers.action")}
            </Label>
            <Select
              value={action}
              onValueChange={(value) => setAction(value as FlagTriggerAction)}
              disabled={saving}
            >
              <SelectTrigger id="trigger-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="turn-on">
                    {t("featureFlags.detailsPage.triggers.turnOn")}
                  </SelectItem>
                  <SelectItem value="turn-off">
                    {t("featureFlags.detailsPage.triggers.turnOff")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger-description">
              {t("featureFlags.detailsPage.triggers.description")}
            </Label>
            <Textarea
              id="trigger-description"
              value={description}
              disabled={saving}
              maxLength={256}
              placeholder={t(
                "featureFlags.detailsPage.triggers.descriptionPlaceholder"
              )}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("featureFlags.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!targetId || !type || !action || saving}
            onClick={() =>
              onCreate({
                targetId,
                type,
                action,
                description: description.trim(),
              })
            }
          >
            {saving
              ? t("featureFlags.detailsPage.triggers.creating")
              : t("featureFlags.detailsPage.triggers.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
