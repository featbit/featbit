import type { ChangeEvent, ReactNode } from "react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  type = "text",
  placeholder,
  icon,
  trailing,
  value,
  disabled,
  autoComplete,
  name,
  required,
  onChange
}: {
  label: string;
  type?: string;
  placeholder: string;
  icon: ReactNode;
  trailing?: ReactNode;
  value: string;
  disabled?: boolean;
  autoComplete?: string;
  name: string;
  required?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputId = useId();

  return (
    <div className="block">
      <Label className="text-base font-medium text-foreground" htmlFor={inputId}>
        {label}
      </Label>
      <span className="relative mt-2 block text-muted-foreground">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2">
          {icon}
        </span>
        <Input
          id={inputId}
          className={cn(
            "h-12 bg-background pl-12 pr-4 text-base shadow-sm focus-visible:border-blue-500 focus-visible:ring-blue-500 dark:bg-transparent",
            trailing && "pr-12"
          )}
          type={type}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          name={name}
          required={required}
          onChange={onChange}
        />
        {trailing ? <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </span>
    </div>
  );
}

export function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-7 text-sm text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
