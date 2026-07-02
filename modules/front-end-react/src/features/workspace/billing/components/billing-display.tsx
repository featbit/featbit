import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function PeriodItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border px-5 py-3 md:border-r md:last:border-r-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

export function FeeRow({ label, value, strong, info }: { label: string; value: string; strong?: boolean; info?: boolean }) {
  return (
    <div className={cn("mt-3 flex items-center justify-between gap-4 text-sm", strong && "font-semibold")}>
      <span className="inline-flex items-center gap-1.5">
        {label}
        {info ? <Info className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </span>
      <span>{value}</span>
    </div>
  );
}

export function FeeLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between border-b px-3 py-2 last:border-b-0", strong && "font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
