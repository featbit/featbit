import type React from "react";
import { cn } from "@/lib/utils";

export function InputField({
  id,
  label,
  error,
  className,
  children
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextInput({
  id,
  disabled,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string }) {
  return (
    <input
      id={id}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      className={cn(
        "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60",
        error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}
