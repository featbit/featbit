import type { ChangeEvent, ReactNode } from "react";
import { useId } from "react";

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
      <label className="text-base font-medium text-foreground" htmlFor={inputId}>
        {label}
      </label>
      <span className="mt-2 flex h-12 items-center gap-4 rounded-md border border-input bg-background px-4 text-muted-foreground shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:bg-transparent">
        {icon}
        <input
          id={inputId}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          type={type}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          name={name}
          required={required}
          onChange={onChange}
        />
        {trailing}
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
