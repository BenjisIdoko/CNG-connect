import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-surface-container-high rounded-xl animate-pulse ${className}`} aria-hidden />
);

/** Placeholder shown while a lazy screen chunk loads — keeps layout stable instead of a lone spinner. */
export const ScreenSkeleton: React.FC = () => (
  <div className="px-5 pt-6 flex flex-col gap-4 min-h-[60vh]" role="status" aria-label="Loading">
    <Skeleton className="h-7 w-48" />
    <div className="flex gap-2">
      <Skeleton className="h-16 flex-1" />
      <Skeleton className="h-16 flex-1" />
      <Skeleton className="h-16 flex-1" />
    </div>
    <Skeleton className="h-12 w-full rounded-full" />
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-[0_4px_14px_rgba(31,41,35,0.05)]">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
    <span className="sr-only">Loading…</span>
  </div>
);
