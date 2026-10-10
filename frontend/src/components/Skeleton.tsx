export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-chip ${className}`} aria-hidden="true" />;
}

export function LotCardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="border border-line bg-surface p-[18px]"><Skeleton className="aspect-[4/5] rounded-none" /></div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
