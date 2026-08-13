import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  addTeamMember,
  type GroupOption,
  type PolicyOption,
} from "../../team-api"
import { GroupMultiPicker, PolicyMultiPicker } from "./permission-multi-picker"

export function AddMemberSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [policies, setPolicies] = useState<PolicyOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [emailError, setEmailError] = useState<string | null>(null)
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const sheetContentRef = useRef<HTMLDivElement | null>(null)

  async function submit() {
    const hasValidEmail = /^\S+@\S+\.\S+$/.test(email.trim())
    const hasPermissions = policies.length > 0 || groups.length > 0
    setEmailError(hasValidEmail ? null : t("iam.team.add.emailInvalid"))
    setPermissionsError(
      hasPermissions ? null : t("iam.team.add.permissionRequired")
    )
    if (!hasValidEmail || !hasPermissions) return

    setSaving(true)
    try {
      await addTeamMember({
        email: email.trim(),
        policyIds: policies.map((policy) => policy.id),
        groupIds: groups.map((group) => group.id),
      })
      toast.success(t("iam.team.operationSucceeded"))
      onAdded()
    } catch {
      toast.error(t("iam.team.operationFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={sheetContentRef}
        className="gap-0 p-0 data-[side=right]:w-[min(100vw,500px)] data-[side=right]:sm:max-w-[500px]"
      >
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle>{t("iam.team.add.title")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="team-member-email">{t("iam.team.add.email")}</Label>
            <Input
              id="team-member-email"
              value={email}
              placeholder={t("iam.team.add.emailPlaceholder")}
              aria-invalid={Boolean(emailError)}
              onChange={(event) => {
                const nextEmail = event.target.value
                setEmail(nextEmail)
                if (/^\S+@\S+\.\S+$/.test(nextEmail.trim())) {
                  setEmailError(null)
                }
              }}
            />
            {emailError ? (
              <p className="text-sm text-destructive">{emailError}</p>
            ) : null}
          </div>
          <section className="space-y-4">
            <div className="flex items-center gap-5">
              <h3 className="text-sm font-semibold text-foreground">
                {t("iam.team.add.permissions")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("iam.team.add.permissionsHint")}
              </p>
            </div>
            <PolicyMultiPicker
              portalContainer={sheetContentRef}
              selected={policies}
              onSelectedChange={(next) => {
                setPolicies(next)
                if (next.length > 0 || groups.length > 0) {
                  setPermissionsError(null)
                }
              }}
            />
            <GroupMultiPicker
              portalContainer={sheetContentRef}
              selected={groups}
              onSelectedChange={(next) => {
                setGroups(next)
                if (policies.length > 0 || next.length > 0) {
                  setPermissionsError(null)
                }
              }}
            />
            {permissionsError ? (
              <p className="text-sm text-destructive">{permissionsError}</p>
            ) : null}
          </section>
        </div>
        <SheetFooter className="px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" disabled={saving} onClick={submit}>
            {saving ? t("iam.team.add.adding") : t("iam.team.add.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
