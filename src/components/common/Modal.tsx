import React, { useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';
import { useBackLayer } from '../../utils/backLayer';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
  /** No built-in header/padding — the caller draws its own (must render its own close control). */
  bare?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  className = '',
  overlayClassName = '',
  showCloseButton = false,
  bare = false,
}) => {
  useBackLayer(isOpen, onClose);

  // Drag the sheet down (from its top strip) to dismiss — phone bottom sheets only.
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const onDragStart = (e: React.PointerEvent) => {
    dragStart.current = { y: e.clientY, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDragY(Math.max(0, e.clientY - dragStart.current.y));
  };
  const onDragEnd = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const fast = dy / Math.max(1, Date.now() - dragStart.current.t) > 0.6;
    dragStart.current = null;
    setDragY(0);
    if (dy > 110 || (fast && dy > 40)) onClose();
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs animate-fade-in",
            overlayClassName
          )}
        />
        <DialogPrimitive.Content
          aria-label={title || ariaLabel || 'Modal Dialog'}
          aria-describedby={undefined}
          className={cn(
            "fixed z-[101] bg-white focus:outline-none overflow-y-auto shadow-2xl",
            // phone: bottom sheet; sm+: centered dialog
            "inset-x-0 bottom-[var(--kb-inset,0px)] max-h-[calc(90dvh-var(--kb-inset,0px))] rounded-t-[28px]",
            "sm:inset-x-auto sm:bottom-auto sm:max-h-[88dvh] sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[92%] sm:max-w-lg sm:rounded-3xl",
            bare ? "p-0" : "px-5 pt-3 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] sm:p-6",
            className
          )}
          style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        >
          <div
            className="sm:hidden absolute top-0 inset-x-0 h-8 z-10 touch-none flex justify-center pt-3 cursor-grab"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            aria-hidden
          >
            {!bare && <div className="w-10 h-1 bg-surface-container-highest rounded-full" />}
          </div>
          {bare ? (
            <DialogPrimitive.Title className="sr-only">{title || ariaLabel || 'Dialog'}</DialogPrimitive.Title>
          ) : (
            <>
              <div className="sm:hidden h-4" />
              <div className="flex items-center justify-between pb-3">
                {title ? (
                  <DialogPrimitive.Title className="font-extrabold text-body-lg text-slate-900 pr-6 truncate">
                    {title}
                  </DialogPrimitive.Title>
                ) : (
                  <div />
                )}
                <DialogPrimitive.Close
                  aria-label="Close modal"
                  className="w-8 h-8 rounded-full bg-surface-container text-slate-600 hover:bg-surface-container-high flex items-center justify-center transition-colors shrink-0 active:scale-95"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span>
                </DialogPrimitive.Close>
              </div>
            </>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
