import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../lib/utils';

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
            "inset-x-0 bottom-0 max-h-[90vh] rounded-t-[28px]",
            "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-[92%] sm:max-w-lg sm:max-h-[88vh] sm:rounded-3xl",
            bare ? "p-0" : "px-5 pt-3 pb-6 sm:p-6",
            className
          )}
        >
          {bare ? (
            <DialogPrimitive.Title className="sr-only">{title || ariaLabel || 'Dialog'}</DialogPrimitive.Title>
          ) : (
            <>
              <div className="sm:hidden w-10 h-1 bg-surface-container-highest rounded-full mx-auto mb-3" />
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
                  <span className="material-symbols-outlined text-[18px]">close</span>
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
