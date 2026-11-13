import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError } from "../documentation/components/documentation-ui"
import { useDocumentationCopy } from "../documentation/use-documentation-copy"

export function CustomListOptions({
  id,
  options,
  onChange,
}: {
  id: string
  options: string[]
  onChange: (options: string[]) => void
}) {
  const { t } = useDocumentationCopy()
  const [draft, setDraft] = useState("")
  const [error, setError] = useState("")
  function add() {
    const value = draft.trim()
    if (!value) return
    if (
      options.some((option) => option.toLowerCase() === value.toLowerCase())
    ) {
      setError(t("duplicateListOption"))
      return
    }
    onChange([...options, value])
    setDraft("")
    setError("")
  }
  return (
    <div className="mt-3 space-y-2">
      <Label htmlFor={`list-options-${id}`}>{t("listOptions")}</Label>
      <p className="text-xs text-muted-foreground">{t("listOptionsHelp")}</p>
      <div className="flex gap-2">
        <Input
          id={`list-options-${id}`}
          value={draft}
          placeholder={t("listOptionPlaceholder")}
          onChange={(event) => {
            setDraft(event.target.value)
            setError("")
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!draft.trim()}
          onClick={add}
        >
          <Plus />
          {t("addOption")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Badge key={option} variant="secondary" className="gap-1">
            {option}
            <button
              type="button"
              aria-label={t("removeListOption", { option })}
              className="rounded-sm p-0.5 hover:bg-muted"
              onClick={() =>
                onChange(options.filter((item) => item !== option))
              }
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <FieldError message={error} />
    </div>
  )
}
