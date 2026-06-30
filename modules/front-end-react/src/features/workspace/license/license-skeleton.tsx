export function LicenseSkeleton() {
  return (
    <div className="space-y-6 py-7">
      <div className="h-16 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
