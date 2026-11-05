import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function InputField({
  id,
  label,
  error,
  description,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  description?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="block text-sm font-medium">
        {label}
      </Label>
      {children}
      {description ? (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  )
}

export function TextInput({
  id,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  error?: string
}) {
  return (
    <Input
      id={id}
      aria-invalid={Boolean(error)}
      className={cn(error && "border-destructive", className)}
      {...props}
    />
  )
}
