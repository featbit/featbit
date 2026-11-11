import type { UseFormReturn } from "react-hook-form"
import { Controller } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DescriptionEditor } from "../../documentation/components/description-editor"
import { FieldError } from "../../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../../documentation/use-documentation-copy"
import { CustomFieldInputs } from "../../custom-fields/custom-field-inputs"
import type {
  CustomField,
  FlagSettingsFormValues,
} from "../../custom-fields/custom-fields-model"

export type FlagDocumentationTab = "description" | "customFields"

export function FlagDocumentationTabs({
  form,
  fields,
  disabled,
  tab,
  onTabChange,
}: {
  form: UseFormReturn<FlagSettingsFormValues>
  fields: CustomField[]
  disabled: boolean
  tab: FlagDocumentationTab
  onTabChange: (tab: FlagDocumentationTab) => void
}) {
  const { t } = useDocumentationCopy()
  return (
    <Tabs
      value={tab}
      onValueChange={(value) =>
        onTabChange(value === "customFields" ? "customFields" : "description")
      }
      className="gap-0 overflow-hidden rounded-xl border"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 p-2">
        <TabsList aria-label={t("flagInformation")}>
          <TabsTrigger value="description">{t("description")}</TabsTrigger>
          <TabsTrigger value="customFields">
            {t("customFields")}
            {fields.length ? (
              <span className="ml-1 text-xs text-muted-foreground">
                {fields.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="description" keepMounted className="space-y-2 p-4">
        <Label htmlFor="flag-description">{t("description")}</Label>
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <DescriptionEditor
              id="flag-description"
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              invalid={!!form.formState.errors.description}
            />
          )}
        />
        <FieldError message={form.formState.errors.description?.message} />
      </TabsContent>
      <TabsContent value="customFields" keepMounted className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">{t("customValuesHelp")}</p>
        <CustomFieldInputs fields={fields} form={form} disabled={disabled} />
      </TabsContent>
    </Tabs>
  )
}
