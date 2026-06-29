import type React from "react";
import { cn } from "@/lib/utils";

export function SkeletonForm() {
  return (
    <div className="space-y-5">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-16 animate-pulse rounded-md bg-muted" />
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function Section({
  title,
  icon,
  children,
  className
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border py-8 first:pt-7 last:border-b-0", className)}>
      {title ? (
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-normal text-foreground">{title}</h2>
          {icon}
        </div>
      ) : null}
      {children}
    </section>
  );
}
