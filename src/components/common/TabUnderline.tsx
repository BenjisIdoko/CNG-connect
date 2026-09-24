import React, { useLayoutEffect, useState } from 'react';

/**
 * Sliding underline for a Radix Tabs.List (or any container whose active child has
 * data-state="active"). Put it inside a `relative` list; it measures the active
 * trigger and glides to it. Pass anything that can change trigger widths as `deps`.
 */
export const TabUnderline: React.FC<{
  listRef: React.RefObject<HTMLElement | null>;
  active: string;
  deps?: unknown[];
}> = ({ listRef, active, deps = [] }) => {
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-state="active"]');
    if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);

  if (!box) return null;
  return (
    <span
      aria-hidden
      className="absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-primary transition-[transform,width] duration-300 ease-[cubic-bezier(0.3,1,0.4,1)]"
      style={{ transform: `translateX(${box.x}px)`, width: box.w }}
    />
  );
};
