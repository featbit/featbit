import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const PROFILE_ACTION_BUTTON_CLASS = "w-44"

export function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="block text-sm font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  )
}

export function ProfileInput({
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
