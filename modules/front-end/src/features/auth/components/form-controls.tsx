import { useId, type ChangeEvent, type ReactNode, type Ref } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function Field({
  label,
  type = "text",
  placeholder,
  icon,
  trailing,
  value,
  disabled,
  readOnly,
  autoComplete,
  name,
  required,
  description,
  error,
  inputRef,
  onChange,
}: {
  label: string
  type?: string
  placeholder: string
  icon: ReactNode
  trailing?: ReactNode
  value: string
  disabled?: boolean
  readOnly?: boolean
  autoComplete?: string
  name: string
  required?: boolean
  description?: string
  error?: string
  inputRef?: Ref<HTMLInputElement>
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const inputId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const describedBy = error ? errorId : description ? descriptionId : undefined

  return (
    <div>
      <Label htmlFor={inputId}>{label}</Label>
      <span
        className={cn(
          "relative mt-2 block text-muted-foreground",
          error && "text-destructive"
        )}
      >
        <span className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2">
          {icon}
        </span>
        <Input
          ref={inputRef}
          id={inputId}
          className={cn(
            "h-12 pr-4 pl-12 text-base text-foreground",
            trailing && "pr-12"
          )}
          type={type}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={onChange}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-4 flex items-center">
            {trailing}
          </span>
        ) : null}
      </span>
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : description ? (
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-center gap-4 text-sm text-muted-foreground">
      <span className="flex-1">
        <Separator />
      </span>
      <span className="whitespace-nowrap">{children}</span>
      <span className="flex-1">
        <Separator />
      </span>
    </div>
  )
}
