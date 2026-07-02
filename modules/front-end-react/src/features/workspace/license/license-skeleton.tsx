import { Skeleton } from "@/components/ui/skeleton";

export function LicenseSkeleton() {
  return (
    <div className="space-y-6 py-7">
      <Skeleton className="h-16" />
      <Skeleton className="h-24" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
